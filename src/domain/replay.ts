// Replays of past moves: a fresh Choreography fed old entries at new times. A move is
// self-contained in the journal (where it starts, every step, how it ends), so the moving team
// plays it exactly. A single move leaves the other teams where they are now; "watch from here"
// starts every team from a past state and plays everything since, one entry after another.
import type { GameEvent, JournalEntry } from './events'
import type { TeamId, TileId } from './ids'
import { CUE_MS, Choreography } from './motion'

/** Pause between replayed entries, so one move ends before the next begins. */
export const REPLAY_GAP_MS = 700
/** Entries further apart than this get a "… later" note when a replay moves on to them. */
export const LATER_MIN_MS = 5 * 60_000
/** "Watch from here" pauses longer between entries, so each one can be taken in. */
export const WATCH_GAP_MS = 2000
/** How long a replay stays up after its pieces settle, counting down, before going back to live. */
export const RETURN_COUNTDOWN_S = 3
/** The team an event moves, if it moves one. */
function movedTeam(event: GameEvent): TeamId | null {
  switch (event.kind) {
    case 'move_confirmed':
    case 'stepped':
    case 'teleported':
      return event.teamId
    default:
      return null
  }
}

/** Teams an entry moves, in order. */
export function movesIn(entry: JournalEntry): TeamId[] {
  const teams = entry.events.map(movedTeam).filter((t): t is TeamId => t !== null)
  return [...new Set(teams)]
}

/** Where a team stood just before entry `seq`, from the entries before it; null if unknown. */
export function tileBefore(log: readonly JournalEntry[], seq: number, team: TeamId): TileId | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i]
    if (!entry || entry.seq >= seq) continue
    for (let j = entry.events.length - 1; j >= 0; j--) {
      const e = entry.events[j]
      if (!e) continue
      if (e.kind === 'game_started') return e.positions[team] ?? null
      if ('teamId' in e && e.teamId !== team) continue
      if (e.kind === 'stepped' || e.kind === 'landed') return e.tileId
      if (e.kind === 'teleported') return e.to
    }
  }
  return null
}

/**
 * The entries that make up the move in entry `seq`: the card the team drew for it, the move
 * itself, and later entries that carry on the same walk (after a shop paused it).
 */
export function watchEntries(log: readonly JournalEntry[], seq: number): JournalEntry[] {
  const at = log.findIndex((e) => e.seq === seq)
  const entry = log[at]
  const team = entry ? movesIn(entry)[0] : undefined
  if (!entry || team === undefined) return []
  const out = [entry]
  // The card drawn for it, unless the team moved again in between.
  for (let i = at - 1; i >= 0; i--) {
    const before = log[i]
    if (!before || movesIn(before).includes(team)) break
    if (before.events.some((e) => e.kind === 'card_drawn' && e.teamId === team)) {
      out.unshift(before)
      break
    }
  }
  // The rest of the walk, until the team lands or starts a new one.
  const landed = (e: JournalEntry) =>
    e.events.some((ev) => ev.kind === 'landed' && ev.teamId === team)
  for (let i = at + 1; i < log.length && !landed(out[out.length - 1] as JournalEntry); i++) {
    const after = log[i]
    if (!after || !movesIn(after).includes(team)) continue
    if (after.events.some((e) => e.kind === 'move_confirmed' && e.teamId === team)) break
    out.push(after)
  }
  return out
}

/** Moves after `after` (a last visit) up to `upTo` (when this page loaded): what was missed. */
export const missedMoveEntries = (log: readonly JournalEntry[], after: number, upTo: number) =>
  log.filter((e) => e.seq > after && e.seq <= upTo && movesIn(e).length > 0)

export type Replay = {
  choreography: Choreography
  /** Teams whose pieces the replay draws; the rest stay live. */
  teams: ReadonlySet<TeamId>
  /** When each replayed entry starts, and the team it is about (for the camera). */
  focus: { at: number; team: TeamId }[]
  /** Each replayed entry, oldest first: when it starts and when it has played out. */
  steps: { entry: JournalEntry; at: number; done: number }[]
  /** When the last replayed piece has settled; the return countdown starts then. */
  settledAt: number
  /** When the countdown is over and the board goes back to live. */
  endsAt: number
}

/**
 * Plays `entries` one after another from `startAt` (server time), each starting once the one
 * before has played out. Each team starts from where it stood before its first replayed entry.
 * `seesItems` keeps item names private as the live board does.
 */
export function buildReplay(
  log: readonly JournalEntry[],
  entries: readonly JournalEntry[],
  startAt: number,
  seesItems: (team: TeamId) => boolean = () => true,
): Replay {
  const choreography = new Choreography()
  const teams = new Set<TeamId>()
  for (const entry of entries)
    for (const team of movesIn(entry)) {
      if (teams.has(team)) continue
      teams.add(team)
      const tile = tileBefore(log, entry.seq, team)
      if (tile !== null) choreography.know(team, tile)
    }
  return play(choreography, teams, entries, startAt, seesItems, REPLAY_GAP_MS)
}

/**
 * Plays `entries` one after another from `startAt`, with every team in `positions` drawn from the
 * replay, starting on its tile there: the board as it was just before the first entry.
 */
export function buildReplayFrom(
  positions: ReadonlyMap<TeamId, TileId>,
  entries: readonly JournalEntry[],
  startAt: number,
  seesItems: (team: TeamId) => boolean = () => true,
): Replay {
  const choreography = new Choreography()
  for (const [team, tile] of positions) choreography.know(team, tile)
  return play(choreography, new Set(positions.keys()), entries, startAt, seesItems, WATCH_GAP_MS)
}

function play(
  choreography: Choreography,
  teams: Set<TeamId>,
  entries: readonly JournalEntry[],
  startAt: number,
  seesItems: (team: TeamId) => boolean,
  /** The pause after an entry; a card draw is always followed quickly by the walk it is for. */
  gap: number,
): Replay {
  const focus: { at: number; team: TeamId }[] = []
  const steps: Replay['steps'] = []
  let at = startAt
  for (const [i, entry] of entries.entries()) {
    const team = movesIn(entry)[0] ?? cardTeam(entry)
    if (team !== null) focus.push({ at, team })
    choreography.apply({ ...entry, at: new Date(at) }, seesItems)
    const done = Math.max(at, choreography.revealAt(entry.seq))
    steps.push({ entry, at, done })
    const next = entries[i + 1]
    const walkFollows = next !== undefined && team !== null && movesIn(next)[0] === team
    at = done + (cardTeam(entry) === team && walkFollows ? REPLAY_GAP_MS : gap)
  }
  const settled = Math.max(at, ...[...teams].map((t) => choreography.settlesAt(t)))
  const endsAt = Math.max(settled + RETURN_COUNTDOWN_S * 1000, settled + CUE_MS)
  return { choreography, teams, focus, steps, settledAt: settled, endsAt }
}

const cardTeam = (entry: JournalEntry): TeamId | null => {
  const card = entry.events.find((e) => e.kind === 'card_drawn')
  return card && 'teamId' in card ? card.teamId : null
}

/** How long after `from` the entry at `to` happened, like "2 hours 10 minutes later"; null if soon after. */
export function timeLater(from: Date, to: Date): string | null {
  const ms = to.getTime() - from.getTime()
  if (ms < LATER_MIN_MS) return null
  const minutes = Math.round(ms / 60_000)
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  if (minutes < 60) return `${unit(minutes, 'minute')} later`
  const hours = Math.floor(minutes / 60)
  const rest = Math.round((minutes % 60) / 5) * 5
  if (rest === 0 || rest === 60) return `${unit(rest === 60 ? hours + 1 : hours, 'hour')} later`
  return `${unit(hours, 'hour')} ${unit(rest, 'minute')} later`
}

/** A replayed entry's time of day, with the weekday when it was not today, like "Fri 23:10". */
export function replayTime(at: Date, now: Date): string {
  const time = at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (at.toDateString() === now.toDateString()) return time
  return `${at.toLocaleDateString([], { weekday: 'short' })} ${time}`
}
