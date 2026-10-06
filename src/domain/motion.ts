// Where each team's piece should be drawn, and when, worked out from the journal alone.
//
// The server resolves a whole walk in one command, so one journal entry holds every step. Each
// entry's `at` plus a fixed pace per step says where a walking team should be at any moment
// (docs/api.md, "Animation timing"). Because the timing is anchored to the server's clock, a
// reloaded page resumes a walk mid-way instead of skipping to its end.
import { blockerName, cardLabel, effectText, itemName } from './describe'
import type { GameEvent, JournalEntry } from './events'
import type { Card } from './game'
import type { TeamId, TileId } from './ids'

export const STEP_MS = 420
export const TELEPORT_MS = 1100
export const SLIDE_MS = 650
/** How long an effect callout stays up. */
export const CUE_MS = 2600
/** Gap between callouts raised at the same moment, so they don't stack on top of each other. */
const CUE_GAP_MS = 500
/** A drawn card holds the floor a little longer before the next callout. */
const CARD_CUE_GAP_MS = 1400

export type SegmentKind = 'walk' | 'teleport' | 'slide'

/** One move of a piece between two tiles, in server time (ms since the epoch). */
export type Segment = { from: TileId; to: TileId; kind: SegmentKind; start: number; end: number }

export type CueTone = 'good' | 'bad' | 'info' | 'gem' | 'card'

/** A short callout over a team's piece, like "+20 gold" or "Frozen". */
export type Cue = {
  id: string
  teamId: TeamId
  text: string
  tone: CueTone
  at: number
  /** Card cues draw a small card instead of a label. */
  card?: Card
}

/** Where to draw a piece at one moment. */
export type Placement =
  | { kind: 'still'; tile: TileId }
  | { kind: SegmentKind; from: TileId; to: TileId; progress: number }

export class Choreography {
  private readonly segments = new Map<TeamId, Segment[]>()
  /** Where each team will be once its queued segments have played. */
  private readonly lastTile = new Map<TeamId, TileId>()
  /** When each team's queued segments end; later entries queue behind them. */
  private readonly busyUntil = new Map<TeamId, number>()
  private cues: Cue[] = []
  /** When each entry's last animation ends, so text about it can wait until then. */
  private readonly reveal = new Map<number, number>()
  private lastSeq = 0

  /** Adds an entry's movement and callouts. Entries must arrive in order; repeats are ignored. */
  apply(entry: JournalEntry): void {
    if (entry.seq <= this.lastSeq) return
    this.lastSeq = entry.seq
    const at = entry.at.getTime()
    const cursor = new Map<TeamId, number>()
    const now = (team: TeamId) => {
      let t = cursor.get(team)
      if (t === undefined) {
        t = Math.max(at, this.busyUntil.get(team) ?? 0)
        cursor.set(team, t)
      }
      return t
    }
    const move = (team: TeamId, to: TileId, kind: SegmentKind) => {
      const from = this.lastTile.get(team) ?? to
      const start = now(team)
      const length = kind === 'walk' ? STEP_MS : kind === 'teleport' ? TELEPORT_MS : SLIDE_MS
      const end = start + length
      if (from !== to) this.queue(team, { from, to, kind, start, end })
      cursor.set(team, end)
      this.busyUntil.set(team, Math.max(this.busyUntil.get(team) ?? 0, end))
      this.lastTile.set(team, to)
    }
    const cueTimes = new Map<TeamId, number>()
    const cue = (team: TeamId, text: string, tone: CueTone, index: number, card?: Card) => {
      const earliest = cueTimes.get(team) ?? 0
      const time = Math.max(now(team), earliest)
      cueTimes.set(team, time + (card ? CARD_CUE_GAP_MS : CUE_GAP_MS))
      this.cues.push({ id: `${entry.seq}.${index}`, teamId: team, text, tone, at: time, card })
    }

    entry.events.forEach((event, index) => {
      switch (event.kind) {
        case 'game_started':
          event.positions.forEach((tile, team) => this.lastTile.set(team as TeamId, tile))
          return
        case 'move_confirmed':
          if (event.path[0] !== undefined) this.lastTile.set(event.teamId, event.path[0])
          return
        case 'stepped':
          return move(event.teamId, event.tileId, 'walk')
        case 'landed':
          this.lastTile.set(event.teamId, event.tileId)
          return
        case 'teleported':
          if (!this.lastTile.has(event.teamId)) this.lastTile.set(event.teamId, event.from)
          cue(event.teamId, 'Whoosh!', 'info', index)
          return move(event.teamId, event.to, 'teleport')
        case 'card_drawn':
          return cue(event.teamId, cardLabel(event.card), 'card', index, event.card)
        case 'trap_triggered':
          cue(event.teamId, `${blockerName(event.trap)}!`, 'bad', index)
          return move(event.teamId, event.to, 'slide')
      }
      const callout = cueFor(event)
      if (callout) cue(callout.team, callout.text, callout.tone, index)
    })
    this.reveal.set(entry.seq, Math.max(at, ...cursor.values()))
  }

  /** When an entry's animations have played out (ms, server time). */
  revealAt(seq: number): number {
    return this.reveal.get(seq) ?? 0
  }

  /** Tells it where a team stands, for teams whose last move is older than the entries it saw. */
  know(team: TeamId, tile: TileId): void {
    if (!this.lastTile.has(team)) this.lastTile.set(team, tile)
  }

  private queue(team: TeamId, segment: Segment) {
    const list = this.segments.get(team)
    if (list) list.push(segment)
    else this.segments.set(team, [segment])
  }

  /** Where to draw a team at `time`, or null when it has no animation left and sits where the state says. */
  placement(team: TeamId, time: number): Placement | null {
    const list = this.segments.get(team)
    if (!list || list.length === 0) return null
    const first = list[0]
    const last = list.at(-1)
    if (!first || !last || time >= last.end) return null
    if (time < first.start) return { kind: 'still', tile: first.from }
    for (const s of [...list].reverse()) {
      if (time < s.start) continue
      if (time >= s.end) return { kind: 'still', tile: s.to }
      return {
        kind: s.kind,
        from: s.from,
        to: s.to,
        progress: (time - s.start) / (s.end - s.start),
      }
    }
    return { kind: 'still', tile: first.from }
  }

  /** Whether the team's piece is still catching up with the state. */
  isAnimating(team: TeamId, time: number): boolean {
    return this.placement(team, time) !== null
  }

  /** When the team's last queued animation ends. */
  settlesAt(team: TeamId): number {
    return this.busyUntil.get(team) ?? 0
  }

  /** Callouts showing at `time`. */
  activeCues(time: number): Cue[] {
    return this.cues.filter((c) => time >= c.at && time < c.at + CUE_MS)
  }

  /** Forgets everything that finished before `time`. */
  prune(time: number): void {
    for (const [team, list] of this.segments) {
      const live = list.filter((s) => s.end > time)
      if (live.length === 0) this.segments.delete(team)
      else this.segments.set(team, live)
    }
    this.cues = this.cues.filter((c) => c.at + CUE_MS > time)
    for (const [seq, at] of this.reveal) if (at <= time) this.reveal.delete(seq)
  }
}

function cueFor(event: GameEvent): { team: TeamId; text: string; tone: CueTone } | null {
  switch (event.kind) {
    case 'gem_collected':
      return { team: event.teamId, text: `${capital(event.gem)} gem!`, tone: 'gem' }
    case 'gem_stolen':
      return { team: event.to, text: `Stole the ${event.gem} gem!`, tone: 'gem' }
    case 'gem_lost':
      return { team: event.teamId, text: `Lost the ${event.gem} gem`, tone: 'bad' }
    case 'gold_changed':
      return {
        team: event.teamId,
        text: event.delta >= 0 ? `+${event.delta} gold` : `−${-event.delta} gold`,
        tone: event.delta >= 0 ? 'good' : 'bad',
      }
    case 'item_gained':
      return { team: event.teamId, text: `+ ${itemName(event.item)}`, tone: 'good' }
    case 'item_lost':
      return event.reason === 'blocked a freeze'
        ? { team: event.teamId, text: `${itemName(event.item)} blocked a freeze!`, tone: 'good' }
        : null
    case 'item_used':
      return { team: event.teamId, text: itemName(event.item), tone: 'info' }
    case 'frozen':
      return { team: event.teamId, text: 'Frozen!', tone: 'bad' }
    case 'thawed':
      return { team: event.teamId, text: 'Thawed out', tone: 'good' }
    case 'tile_completed':
      return { team: event.teamId, text: 'Tile complete!', tone: 'good' }
    case 'random_event':
      return { team: event.teamId, text: event.title, tone: 'info' }
    case 'joker_effect':
      return { team: event.teamId, text: `Joker: ${effectText(event.effect)}`, tone: 'info' }
    case 'match_started':
      return { team: event.mover, text: 'Match!', tone: 'bad' }
    case 'match_won':
      return { team: event.winner, text: 'Won the match!', tone: 'good' }
    case 'minigame_opened':
      return { team: event.initiator, text: 'Minigame!', tone: 'info' }
    case 'shop_opened':
      return { team: event.teamId, text: 'Shop', tone: 'info' }
    default:
      return null
  }
}

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
