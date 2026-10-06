// What each item does and what it is used on, from the server's rules (`src/engine/items.rs`).
import type { Team } from './game'
import type { Item } from './vocabulary'

/** `team`: a rival team. `tile`: a free tile within `BLOCKER_RANGE` steps. */
export type ItemTargetKind = 'none' | 'team' | 'tile'

export type ItemInfo = {
  target: ItemTargetKind
  /** One sentence, for the shop and the inventory. */
  text: string
}

/** How far from the team a blocker may be placed (`blocker_range` in the game config). */
export const BLOCKER_RANGE = 10

const bell = (gem: string): ItemInfo => ({
  target: 'none',
  text: `Kept until needed: if the team loses a match while holding it, the bell is spent instead of the ${gem} gem.`,
})

export const ITEM_INFO: Record<Item, ItemInfo> = {
  owls_feather: { target: 'none', text: 'Doubles your next move.' },
  migrant_bird: { target: 'none', text: 'Triples your next move.' },
  phoenix_feather: { target: 'none', text: 'Quadruples your next move.' },
  harp_of_rain: { target: 'team', text: "Halves a rival's next move." },
  bird_whistle: { target: 'none', text: 'Flies your team to a random tile.' },
  whale_whistle: { target: 'none', text: 'Carries your team to a random tile.' },
  turtle_whistle: {
    target: 'team',
    text: 'Sends a rival that is not moving or in a match to a random tile.',
  },
  royal_ring: {
    target: 'none',
    text: 'Sends every team not moving or in a match to a random shop.',
  },
  banana_peel: {
    target: 'tile',
    text: 'A trap: the first team to pass over slips back a tile and is frozen.',
  },
  bee_whistle: { target: 'tile', text: 'A trap: the first team to pass over stops on that tile.' },
  snake_whistle: {
    target: 'tile',
    text: 'A trap: the first team to land there is sent back five tiles.',
  },
  giants_lamp: { target: 'tile', text: 'Drops a rock no one can walk through for 12 hours.' },
  sleeping_potion: { target: 'team', text: 'Freezes a rival for 6 hours.' },
  monks_ring: { target: 'team', text: 'Freezes a rival for 3 hours.' },
  monks_pendant: {
    target: 'none',
    text: 'Kept until needed: blocks the next freeze on your team, from any source, then is used up.',
  },
  club_hat: { target: 'none', text: 'For your next 5 draws, a club also pays gold by its rank.' },
  heart_glove: {
    target: 'none',
    text: 'For your next 5 draws, a heart also pays gold by its rank.',
  },
  diamond_boot: { target: 'none', text: 'For 6 hours, other teams only move on diamonds.' },
  spade_boot: { target: 'none', text: 'For 6 hours, other teams only move on spades.' },
  blue_bell: bell('blue'),
  green_bell: bell('green'),
  purple_bell: bell('purple'),
  red_bell: bell('red'),
  yellow_bell: bell('yellow'),
  orange_bell: bell('orange'),
  pink_bell: bell('pink'),
  white_bell: bell('white'),
  mystery_box: { target: 'none', text: 'Opens into a random item.' },
}

/** Items that do nothing when used; they work by being held. */
export const PASSIVE_ITEMS: ReadonlySet<Item> = new Set<Item>([
  'monks_pendant',
  'blue_bell',
  'green_bell',
  'purple_bell',
  'red_bell',
  'yellow_bell',
  'orange_bell',
  'pink_bell',
  'white_bell',
])

/**
 * Shop prices, always the listed price. The API does not serve the shop yet, so these mirror the
 * backend's `config/sample/game.toml`; the server's price wins when they differ.
 */
export const SHOP_PRICES: Partial<Record<Item, number>> = {
  owls_feather: 40,
  migrant_bird: 80,
  phoenix_feather: 100,
  harp_of_rain: 30,
  bird_whistle: 20,
  whale_whistle: 20,
  turtle_whistle: 30,
  royal_ring: 50,
  banana_peel: 10,
  bee_whistle: 10,
  snake_whistle: 10,
  giants_lamp: 10,
  sleeping_potion: 30,
  monks_ring: 20,
  monks_pendant: 20,
  club_hat: 30,
  heart_glove: 30,
  diamond_boot: 30,
  spade_boot: 30,
  blue_bell: 30,
  green_bell: 30,
  purple_bell: 30,
  red_bell: 30,
  yellow_bell: 30,
  orange_bell: 30,
  pink_bell: 30,
  white_bell: 30,
  mystery_box: 40,
}

export const INVENTORY_LIMIT = 10

export const inventorySize = (team: Team) => [...team.items.values()].reduce((a, b) => a + b, 0)

/** What an item acts on, so captains can see at a glance what a power-up is for. */
export type ItemGroup = 'draw' | 'you' | 'rival' | 'board' | 'everyone' | 'held'

export const ITEM_GROUPS: Record<ItemGroup, { label: string; hint: string }> = {
  draw: { label: 'Your draw', hint: 'Changes the card you are about to draw' },
  you: { label: 'Your token', hint: 'Moves or frees your own piece' },
  rival: { label: 'A rival', hint: 'Slows, freezes or moves another team' },
  board: { label: 'The board', hint: 'Leaves a trap or a rock on a tile near you' },
  everyone: { label: 'Everyone', hint: 'Affects every team at once' },
  held: { label: 'Kept', hint: 'Works by being held; nothing to use' },
}

export const ITEM_GROUP: Record<Item, ItemGroup> = {
  owls_feather: 'draw',
  migrant_bird: 'draw',
  phoenix_feather: 'draw',
  club_hat: 'draw',
  heart_glove: 'draw',
  mystery_box: 'you',
  bird_whistle: 'you',
  whale_whistle: 'you',
  harp_of_rain: 'rival',
  turtle_whistle: 'rival',
  sleeping_potion: 'rival',
  monks_ring: 'rival',
  banana_peel: 'board',
  bee_whistle: 'board',
  snake_whistle: 'board',
  giants_lamp: 'board',
  royal_ring: 'everyone',
  diamond_boot: 'everyone',
  spade_boot: 'everyone',
  monks_pendant: 'held',
  blue_bell: 'held',
  green_bell: 'held',
  purple_bell: 'held',
  red_bell: 'held',
  yellow_bell: 'held',
  orange_bell: 'held',
  pink_bell: 'held',
  white_bell: 'held',
}

/**
 * Why the team cannot use an item right now, or null if it can. Mirrors the server's rule
 * (`use_item` in docs/api.md): power-ups are a decision taken between finishing a tile and drawing,
 * one per tile, never while frozen or in a match.
 */
export function whyNotUsable(team: Team, item: Item, now: Date): string | null {
  if (PASSIVE_ITEMS.has(item)) return 'Works while held'
  if (team.frozenUntil !== null && team.frozenUntil > now) return 'Not while frozen'
  if (team.matchId !== null) return 'Not during a match'
  if (team.effects.itemUsedHere) return 'Already used an item on this tile'
  switch (team.status.kind) {
    case 'ready':
      return null
    case 'working':
      return 'Finish your tile first'
    case 'drawn':
      return 'Too late: the card is drawn'
    case 'moving':
      return 'Not while moving'
    case 'idle':
      return 'The game has not started'
  }
}
