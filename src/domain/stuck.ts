// What holds a team in place, and how the board words it. The server has one rule for all of
// them, a freeze (`frozenUntil`, `frozenBy`), but a team that slipped on a banana is not frozen,
// so each item gets its own words and look. Players read "stuck" where the cause doesn't matter.
import type { Item } from './vocabulary'

export const STUCK_CAUSES = [
  'banana',
  'harpie_bug_swarm',
  'snake_charmer',
  'wilderness_web',
  'ice_barrage',
  'entangle',
  // No item: an admin's freeze, or a card or random event that freezes.
  'other',
] as const
export type StuckCause = (typeof STUCK_CAUSES)[number]

type Wording = {
  /** Over the piece as it happens. */
  callout: string
  /** Before "until 14:00". */
  state: string
}

const WORDING: Record<StuckCause, Wording> = {
  banana: { callout: 'Slipped!', state: 'Floored' },
  harpie_bug_swarm: { callout: 'Swarmed!', state: 'Swarmed' },
  snake_charmer: { callout: 'Charmed!', state: 'Charmed' },
  wilderness_web: { callout: 'Caught in a web!', state: 'Webbed' },
  ice_barrage: { callout: 'Frozen!', state: 'Frozen' },
  entangle: { callout: 'Entangled!', state: 'Entangled' },
  other: { callout: 'Stuck!', state: 'Stuck' },
}

const isCause = (item: string): item is StuckCause =>
  item !== 'other' && (STUCK_CAUSES as readonly string[]).includes(item)

/** The cause of a freeze `item` made; `other` for no item, or one that doesn't freeze. */
export const stuckCause = (item: Item | null): StuckCause =>
  item !== null && isCause(item) ? item : 'other'

/** Whether using or walking onto `item` holds a team in place. */
export const holdsTeams = (item: Item | null): item is Item => stuckCause(item) !== 'other'

export const stuckCallout = (item: Item | null): string => WORDING[stuckCause(item)].callout

/** "Floored", "Frozen" and so on, for "… until 14:00". */
export const stuckState = (item: Item | null): string => WORDING[stuckCause(item)].state
