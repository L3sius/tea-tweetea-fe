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
import { entryContext, soundFor, type SoundAudience, type SoundName } from './sounds'
import { moment, momentOf, type Moment } from './director'

/** Time per tile on a walk: slow enough to watch the characters' walk and run animations. */
export const STEP_MS = 840
export const TELEPORT_MS = 1100
/** After a Joker the team's piece sulks this long before the Joker's effect (a teleport, say) plays. */
export const JOKER_HOLD_MS = 2000
/** How long an effect callout stays up. */
export const CUE_MS = 2600
/** Gap between callouts raised at the same moment, so they don't stack on top of each other. */
const CUE_GAP_MS = 500
/** A drawn card holds the floor a little longer before the next callout. */
const CARD_CUE_GAP_MS = 1400

export type SegmentKind = 'walk' | 'teleport'

/** One move of a piece between two tiles, in server time (ms since the epoch). */
export type Segment = {
  from: TileId
  to: TileId
  kind: SegmentKind
  start: number
  end: number
  /** Steps in the whole walk this segment belongs to (1 for teleports). */
  steps: number
  /** The journal entry it plays, so everyone watching can pick the same variations. */
  seq: number
}

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

/** A sound to play as a moment shows on the board (see sounds.ts). */
export type SoundCue = {
  id: string
  teamId: TeamId
  sound: SoundName
  audience: SoundAudience
  at: number
}

/** How long sounds are kept after their moment, for a player that looks only now and then. */
const SOUND_KEEP_MS = 10_000

/** Where to draw a piece at one moment. */
export type Placement =
  | { kind: 'still'; tile: TileId }
  | { kind: SegmentKind; from: TileId; to: TileId; progress: number; steps: number; seq: number }

/** Moments a team's character reacts to, after any movement that comes first. */
export type ReactionKind = 'celebrate' | 'despair' | 'arrive' | 'use_item' | 'slip'

export type Reaction = {
  id: string
  teamId: TeamId
  kind: ReactionKind
  /** Server time it starts. */
  at: number
}

/** How long reactions are kept after they start; longer than any reaction plays. */
const REACTION_KEEP_MS = 15_000

export class Choreography {
  private readonly segments = new Map<TeamId, Segment[]>()
  /** Where each team will be once its queued segments have played. */
  private readonly lastTile = new Map<TeamId, TileId>()
  /** When each team's queued segments end; later entries queue behind them. */
  private readonly busyUntil = new Map<TeamId, number>()
  private cues: Cue[] = []
  private sounds: SoundCue[] = []
  /** What is worth showing, for the "Follow actions" camera (see director.ts). */
  private moments: Moment[] = []
  private reactions: Reaction[] = []
  /** When each entry's last animation ends, so text about it can wait until then. */
  private readonly reveal = new Map<number, number>()
  private lastSeq = 0
  /** Length of each team's current walk, from its `move_confirmed`. */
  private readonly walkSteps = new Map<TeamId, number>()

  /** Adds an entry's movement and callouts. Entries must arrive in order; repeats are ignored. */
  /** `seesItems`: whether the viewer may know which items a team gains (its own team's only). */
  apply(entry: JournalEntry, seesItems: (team: TeamId) => boolean = () => true): void {
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
    // How many steps each team's walk takes, so a piece can tell a stroll from a run: the whole
    // path when the walk starts here, else the steps this entry holds (a walk resumed after a pause).
    const steps = new Map<TeamId, number>()
    for (const event of entry.events) {
      if (event.kind === 'move_confirmed') this.walkSteps.set(event.teamId, event.path.length - 1)
      if (event.kind === 'stepped') steps.set(event.teamId, (steps.get(event.teamId) ?? 0) + 1)
    }
    // Each team's movement in this entry, as one moment: from its first step until it settles.
    const moving = new Map<TeamId, { start: number; end: number; teleport: boolean }>()
    const move = (team: TeamId, to: TileId, kind: SegmentKind) => {
      const from = this.lastTile.get(team) ?? to
      const start = now(team)
      const span = moving.get(team)
      moving.set(team, {
        start: span?.start ?? start,
        end: start + (kind === 'walk' ? STEP_MS : TELEPORT_MS),
        teleport: (span?.teleport ?? false) || kind === 'teleport',
      })
      const length = kind === 'walk' ? STEP_MS : TELEPORT_MS
      const end = start + length
      const walked = kind === 'walk' ? (this.walkSteps.get(team) ?? steps.get(team) ?? 1) : 1
      if (from !== to)
        this.queue(team, { from, to, kind, start, end, steps: walked, seq: entry.seq })
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

    const react = (team: TeamId, kind: ReactionKind, index: number) =>
      this.reactions.push({ id: `${entry.seq}.${index}`, teamId: team, kind, at: now(team) })
    /** Makes the rest of the entry wait `ms` for this team, so a reaction can be seen. */
    const hold = (team: TeamId, ms: number) => {
      const end = now(team) + ms
      cursor.set(team, end)
      this.busyUntil.set(team, Math.max(this.busyUntil.get(team) ?? 0, end))
    }

    const context = entryContext(entry)
    entry.events.forEach((event, index) => {
      // A sound goes with its moment: before a teleport moves the piece, after a walk lands.
      const shown = momentOf(event)
      if (shown)
        this.moments.push(moment(`${entry.seq}.${index}`, shown.team, shown.kind, now(shown.team)))
      const sound = soundFor(event, context)
      if (sound) {
        const { team, ...rest } = sound
        this.sounds.push({ id: `${entry.seq}.${index}`, teamId: team, ...rest, at: now(team) })
      }
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
          move(event.teamId, event.to, 'teleport')
          return react(event.teamId, 'arrive', index)
        case 'card_drawn':
          cue(event.teamId, cardLabel(event.card), 'card', index, event.card)
          if (event.card.kind !== 'joker') return
          react(event.teamId, 'despair', index)
          return hold(event.teamId, JOKER_HOLD_MS)
        // The team has already stepped onto the blocker's tile; it stops there.
        case 'blocker_triggered':
          cue(event.teamId, `${blockerName(event.blocker)}!`, 'bad', index)
          return react(event.teamId, 'slip', index)
        case 'tile_completed':
          react(event.teamId, 'celebrate', index)
          break
        case 'item_used':
          react(event.teamId, 'use_item', index)
          break
      }
      const callout = cueFor(event, seesItems)
      if (callout) cue(callout.team, callout.text, callout.tone, index)
    })
    for (const [team, span] of moving) {
      const kind = span.teleport ? 'teleporting' : 'walking'
      this.moments.push(moment(`${entry.seq}.move.${team}`, team, kind, span.start, span.end))
    }
    this.reveal.set(entry.seq, Math.max(at, ...cursor.values()))
  }

  /** When an entry's animations have played out (ms, server time). */
  revealAt(seq: number): number {
    return this.reveal.get(seq) ?? 0
  }

  /** Where a team ends up once everything queued for it has played; null if it never moved. */
  finalTile(team: TeamId): TileId | null {
    return this.lastTile.get(team) ?? null
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
        steps: s.steps,
        seq: s.seq,
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

  /** A team's reactions that have started by `time`, latest first. */
  reactionsOf(team: TeamId, time: number): Reaction[] {
    return this.reactions.filter((r) => r.teamId === team && r.at <= time).reverse()
  }

  /** Callouts showing at `time`. */
  activeCues(time: number): Cue[] {
    return this.cues.filter((c) => time >= c.at && time < c.at + CUE_MS)
  }

  /** Moments not yet over at `time`, for the "Follow actions" camera. */
  momentsAt(time: number): Moment[] {
    return this.moments.filter((m) => m.until > time)
  }

  /** Sounds whose moment came after `from` and by `to`, in order. */
  soundsBetween(from: number, to: number): SoundCue[] {
    return this.sounds.filter((s) => s.at > from && s.at <= to)
  }

  /** Forgets everything that finished before `time`. */
  prune(time: number): void {
    for (const [team, list] of this.segments) {
      const live = list.filter((s) => s.end > time)
      if (live.length === 0) this.segments.delete(team)
      else this.segments.set(team, live)
    }
    this.cues = this.cues.filter((c) => c.at + CUE_MS > time)
    this.sounds = this.sounds.filter((s) => s.at + SOUND_KEEP_MS > time)
    this.moments = this.moments.filter((m) => m.until > time)
    this.reactions = this.reactions.filter((r) => r.at + REACTION_KEEP_MS > time)
    for (const [seq, at] of this.reveal) if (at <= time) this.reveal.delete(seq)
  }
}

function cueFor(
  event: GameEvent,
  seesItems: (team: TeamId) => boolean,
): { team: TeamId; text: string; tone: CueTone } | null {
  switch (event.kind) {
    case 'gem_collected':
      return { team: event.teamId, text: `${capital(event.gem)} gem!`, tone: 'gem' }
    case 'gem_lost':
      return { team: event.teamId, text: `Lost the ${event.gem} gem`, tone: 'bad' }
    case 'gold_changed':
      return {
        team: event.teamId,
        text: event.delta >= 0 ? `+${event.delta} gold` : `−${-event.delta} gold`,
        tone: event.delta >= 0 ? 'good' : 'bad',
      }
    case 'item_gained':
      return {
        team: event.teamId,
        text: event.item && seesItems(event.teamId) ? `+ ${itemName(event.item)}` : '+ Item',
        tone: 'good',
      }
    case 'item_lost':
      if (event.reason === 'blocked a freeze')
        return {
          team: event.teamId,
          text: `${event.item ? itemName(event.item) : 'An item'} blocked a freeze!`,
          tone: 'good',
        }
      if (event.reason === 'inventory full')
        return {
          team: event.teamId,
          text:
            event.item && seesItems(event.teamId)
              ? `No room: ${itemName(event.item)} lost`
              : 'No room: item lost',
          tone: 'bad',
        }
      return null
    case 'shielded':
      return { team: event.teamId, text: 'Shielded', tone: 'info' }
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
      return {
        team: event.teamId,
        text: `Joker: ${effectText(event.effect, seesItems(event.teamId))}`,
        tone: 'info',
      }
    case 'minigame_opened':
      return { team: event.initiator, text: 'Minigame!', tone: 'info' }
    case 'shop_opened':
      return { team: event.teamId, text: 'Shop', tone: 'info' }
    default:
      return null
  }
}

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
