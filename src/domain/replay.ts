// Replays of past moves, from the journal alone: a fresh Choreography fed old entries at new times.
// A move is self-contained in the journal (where it starts, every step, how it ends), so the moving
// team plays it exactly; teams that aren't replayed stay where they are now.
import type { GameEvent, JournalEntry } from './events'
import type { TeamId, TileId } from './ids'
import { CUE_MS, Choreography } from './motion'

/** Pause between replayed entries, so one move ends before the next begins. */
export const REPLAY_GAP_MS = 700
/** How long a replay stays up after its pieces settle, counting down, before going back to live. */
export const RETURN_COUNTDOWN_S = 3
/** Most moves a catch-up plays; older ones are left out. */
export const CATCH_UP_MOVES = 12

/** The team an event moves, if it moves one. */
function movedTeam(event: GameEvent): TeamId | null {
  switch (event.kind) {
    case 'move_confirmed':
    case 'stepped':
    case 'teleported':
    case 'trap_triggered':
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
      if (e.kind === 'teleported' || e.kind === 'trap_triggered') return e.to
    }
  }
  return null
}

/**
 * The entries that make up the move in entry `seq`: the card the team drew for it, the move
 * itself, and later entries that carry on the same walk (after a shop or a match paused it).
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

/** The latest moves after `seq` (a last visit), each with the card drawn for it. */
export function catchUpEntries(log: readonly JournalEntry[], seq: number): JournalEntry[] {
  const moves = log.filter((e) => e.seq > seq && movesIn(e).length > 0).slice(-CATCH_UP_MOVES)
  const picked = new Map<number, JournalEntry>()
  for (const move of moves) for (const e of watchEntries(log, move.seq)) picked.set(e.seq, e)
  return [...picked.values()].sort((a, b) => a.seq - b.seq)
}

export type Replay = {
  choreography: Choreography
  /** Teams whose pieces the replay draws; the rest stay live. */
  teams: ReadonlySet<TeamId>
  /** When each replayed entry starts, and the team it is about (for the camera). */
  focus: { at: number; team: TeamId }[]
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
  const focus: { at: number; team: TeamId }[] = []
  let at = startAt
  for (const entry of entries) {
    const team = movesIn(entry)[0] ?? cardTeam(entry)
    if (team !== null) focus.push({ at, team })
    choreography.apply({ ...entry, at: new Date(at) }, seesItems)
    at = Math.max(at, choreography.revealAt(entry.seq)) + REPLAY_GAP_MS
  }
  const settled = Math.max(at, ...[...teams].map((t) => choreography.settlesAt(t)))
  const endsAt = Math.max(settled + RETURN_COUNTDOWN_S * 1000, settled + CUE_MS)
  return { choreography, teams, focus, settledAt: settled, endsAt }
}

const cardTeam = (entry: JournalEntry): TeamId | null => {
  const card = entry.events.find((e) => e.kind === 'card_drawn')
  return card && 'teamId' in card ? card.teamId : null
}
