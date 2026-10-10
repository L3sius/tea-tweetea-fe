// "Follow actions": a camera that follows whatever is happening on the board. The Choreography
// records moments (a walk, a teleport, an item used, a gem collected); the director picks which
// team the camera shows, one at a time, by how much each moment matters.
import type { GameEvent } from './events'
import type { TeamId } from './ids'

/** What a team is doing, as the camera bar says it. */
export type MomentKind =
  | 'gem'
  | 'won'
  | 'joker'
  | 'minigame'
  | 'caught'
  | 'walking'
  | 'teleporting'
  | 'frozen'
  | 'item'
  | 'tile'

/** A few words for the camera bar: "Varrock Sewer Rats · walking". */
export const MOMENT_LABEL: Record<MomentKind, string> = {
  gem: 'gem!',
  won: 'won the game!',
  joker: 'Joker!',
  minigame: 'minigame!',
  caught: 'caught',
  walking: 'walking',
  teleporting: 'teleporting',
  frozen: 'under attack',
  item: 'item',
  tile: 'tile done',
}

/** Lower comes first. 1 and 2 are big moments: they may cut a walk short. */
const PRIORITY: Record<MomentKind, number> = {
  gem: 1,
  won: 1,
  joker: 2,
  minigame: 2,
  caught: 2,
  walking: 3,
  teleporting: 3,
  frozen: 4,
  item: 5,
  tile: 5,
}

/** Moments at this priority or above may take the camera from one still playing. */
const BIG = 2

/** Something worth showing, on one team, from `at` until `until` (server ms). */
export type Moment = {
  id: string
  teamId: TeamId
  kind: MomentKind
  priority: number
  at: number
  until: number
}

/** How long a moment that has no movement of its own (a gem, an item) holds the camera. */
export const MOMENT_HOLD_MS = 4_000
/** The least time the camera stays on a team, so it doesn't jump about when much happens at once. */
export const MIN_STAY_MS = 4_000

/** The kind of moment an event is, and the team the camera should show for it. */
export function momentOf(event: GameEvent): { team: TeamId; kind: MomentKind } | null {
  switch (event.kind) {
    case 'gem_collected':
    case 'gem_lost':
      return { team: event.teamId, kind: 'gem' }
    case 'game_ended':
      return event.winner === null ? null : { team: event.winner, kind: 'won' }
    case 'card_drawn':
      return event.card.kind === 'joker' ? { team: event.teamId, kind: 'joker' } : null
    case 'minigame_opened':
      return { team: event.initiator, kind: 'minigame' }
    case 'blocker_triggered':
      return { team: event.teamId, kind: 'caught' }
    // A spell is shown where it lands; other items on the team that used them.
    case 'item_used':
      return event.target?.kind === 'team'
        ? { team: event.target.teamId, kind: 'frozen' }
        : { team: event.teamId, kind: 'item' }
    case 'tile_completed':
      return { team: event.teamId, kind: 'tile' }
    default:
      return null
  }
}

export const moment = (
  id: string,
  teamId: TeamId,
  kind: MomentKind,
  at: number,
  until = at + MOMENT_HOLD_MS,
): Moment => ({ id, teamId, kind, priority: PRIORITY[kind], at, until })

/** What the camera shows: a moment, and since when. `quiet` once nothing is left to show. */
export type Shot = { moment: Moment; since: number; quiet: boolean }

/**
 * The shot at `now`. The camera stays with what it shows until that is over and it has stayed a
 * little while; only a big moment cuts it short. Then it takes the most important moment playing
 * now, the earliest first. With nothing playing it stays on the last team, `quiet`.
 */
export function direct(shot: Shot | null, moments: readonly Moment[], now: number): Shot | null {
  const playing = moments
    .filter((m) => m.at <= now && now < m.until && m.id !== shot?.moment.id)
    .sort((a, b) => a.priority - b.priority || a.at - b.at)
  const best = playing[0]
  if (shot && !shot.quiet) {
    const busy = now < shot.moment.until || now < shot.since + MIN_STAY_MS
    const cuts = best && best.priority <= BIG && best.priority < shot.moment.priority
    if (busy && !cuts) return shot
  }
  if (best) return { moment: best, since: now, quiet: false }
  return shot ? { ...shot, quiet: true } : null
}
