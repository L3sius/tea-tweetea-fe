// What each item does and what it is used on, from the server's rules (`src/engine/items.rs`).
import type { Tile } from './board'
import type { Team } from './game'
import { ITEMS, NECKLACES, type Item } from './vocabulary'

const TARGETS: Partial<Record<Item, ItemTargetKind>> = {
  harp_of_rain: 'team',
  ice_barrage: 'team',
  entangle: 'team',
  banana: 'tile',
  harpie_bug_swarm: 'tile',
  snake_charmer: 'tile',
  wilderness_web: 'tile',
}

/** `team`: a rival team. `tile`: a free tile within `BLOCKER_RANGE` steps. */
export type ItemTargetKind = 'none' | 'team' | 'tile'

/** How far from the team a blocker may be placed (`blocker_range` in the game config). */
export const BLOCKER_RANGE = 10

/** What each item is used on, from the server's `apply_item`. */
export const ITEM_TARGET: Record<Item, ItemTargetKind> = Object.fromEntries(
  ITEMS.map((item) => [item, TARGETS[item] ?? 'none']),
) as Record<Item, ItemTargetKind>

/** Hostile items: their target is shielded from further hostile items for a while after a hit. */
export const HOSTILE_ITEMS: ReadonlySet<Item> = new Set<Item>([
  'harp_of_rain',
  'ice_barrage',
  'entangle',
])

/** An item as the catalogue (`GET /items`) describes it. */
export type ItemEntry = {
  name: string
  description: string
  /** Image URL, typically from the OSRS Wiki. */
  icon: string | null
}

/**
 * The server's catalogue as of writing, so items read well before `/items` arrives or if it fails.
 * The served catalogue replaces it (`useItemCatalogue`); keep it in step with `config/items.toml`.
 */
const FALLBACK_CATALOGUE: Record<Item, ItemEntry> = {
  bronze_feather: {
    name: 'Bronze feather',
    description: 'Your next move is 1.5 times as long (rounded).',
    icon: 'https://oldschool.runescape.wiki/images/Bronze_feather.png',
  },
  silver_feather: {
    name: 'Silver feather',
    description: 'Your next move is twice as long.',
    icon: 'https://oldschool.runescape.wiki/images/Silver_feather.png',
  },
  gold_feather: {
    name: 'Gold feather',
    description: 'Your next move is 2.5 times as long (rounded).',
    icon: null,
  },
  harp_of_rain: {
    name: 'Harp of Rain',
    description:
      "Halves a rival team's next move. Hostile: the target is then shielded for 12 hours.",
    icon: null,
  },
  quetzal_whistle: {
    name: 'Quetzal whistle',
    description: 'On land only: fly to a random land tile away from the gems.',
    icon: 'https://oldschool.runescape.wiki/images/Perfected_quetzal_whistle.png',
  },
  ogre_boat: {
    name: 'Ogre boat',
    description: 'At sea only: sail to a random sea tile away from the gems.',
    icon: 'https://oldschool.runescape.wiki/images/thumb/Ogre_boat.png/300px-Ogre_boat.png',
  },
  group_teleport: {
    name: 'Group teleport',
    description: 'Sends every team that is not moving or in a match to a random shop.',
    icon: 'https://oldschool.runescape.wiki/images/Ice_plateau_teleport_%28tablet%29.png',
  },
  banana: {
    name: 'Banana',
    description:
      'Trap for a nearby tile: a team walking over it slips back a tile and is frozen for 6 hours.',
    icon: 'https://oldschool.runescape.wiki/images/Banana.png',
  },
  harpie_bug_swarm: {
    name: 'Harpie bug swarm',
    description: 'Trap for a nearby tile: a team walking over it stops there.',
    icon: 'https://oldschool.runescape.wiki/images/Harpie_Bug_Swarm.png',
  },
  snake_charmer: {
    name: 'Snake charmer',
    description: 'Trap for a nearby tile: a team landing on it is sent back 5 tiles.',
    icon: 'https://oldschool.runescape.wiki/images/thumb/Ali_the_Snake_Charmer.png/180px-Ali_the_Snake_Charmer.png',
  },
  wilderness_web: {
    name: 'Wilderness web',
    description: 'Blocks a nearby tile for 12 hours: nobody can walk through it.',
    icon: 'https://oldschool.runescape.wiki/images/Web.png',
  },
  ice_barrage: {
    name: 'Ice Barrage',
    description:
      'Freezes a rival team for 6 hours. Hostile: the target is then shielded for 12 hours.',
    icon: 'https://oldschool.runescape.wiki/images/Ice_Barrage.png',
  },
  entangle: {
    name: 'Entangle',
    description:
      'Freezes a rival team for 3 hours. Hostile: the target is then shielded for 12 hours.',
    icon: 'https://oldschool.runescape.wiki/images/Entangle.png',
  },
  protect_from_magic: {
    name: 'Protect from Magic',
    description: 'Passive: blocks the next freeze on your team, then is used up.',
    icon: 'https://oldschool.runescape.wiki/images/Protect_from_Magic.png',
  },
  leprechaun_hat: {
    name: 'Leprechaun hat',
    description: 'For your next 5 draws, a club pays gold.',
    icon: 'https://oldschool.runescape.wiki/images/Leprechaun_hat.png',
  },
  saturated_heart: {
    name: 'Saturated heart',
    description: 'For your next 5 draws, a heart pays gold.',
    icon: 'https://oldschool.runescape.wiki/images/Saturated_heart.png',
  },
  sapphire_necklace: {
    name: 'Sapphire necklace',
    description: 'Passive: protects your blue gem when you lose a match.',
    icon: 'https://oldschool.runescape.wiki/images/Sapphire_necklace.png',
  },
  emerald_necklace: {
    name: 'Emerald necklace',
    description: 'Passive: protects your green gem when you lose a match.',
    icon: 'https://oldschool.runescape.wiki/images/Emerald_necklace.png',
  },
  dragon_necklace: {
    name: 'Dragon necklace',
    description: 'Passive: protects your purple gem when you lose a match.',
    icon: 'https://oldschool.runescape.wiki/images/Dragon_necklace.png',
  },
  ruby_necklace: {
    name: 'Ruby necklace',
    description: 'Passive: protects your red gem when you lose a match.',
    icon: 'https://oldschool.runescape.wiki/images/Ruby_necklace.png',
  },
  gold_necklace: {
    name: 'Gold necklace',
    description: 'Passive: protects your yellow gem when you lose a match.',
    icon: 'https://oldschool.runescape.wiki/images/Gold_necklace.png',
  },
  zenyte_necklace: {
    name: 'Zenyte necklace',
    description: 'Passive: protects your orange gem when you lose a match.',
    icon: 'https://oldschool.runescape.wiki/images/Zenyte_necklace.png',
  },
  topaz_necklace: {
    name: 'Topaz necklace',
    description: 'Passive: protects your pink gem when you lose a match.',
    icon: 'https://oldschool.runescape.wiki/images/Topaz_necklace.png',
  },
  diamond_necklace: {
    name: 'Diamond necklace',
    description: 'Passive: protects your white gem when you lose a match.',
    icon: 'https://oldschool.runescape.wiki/images/Diamond_necklace.png',
  },
  mystery_box: {
    name: 'Mystery box',
    description: 'Opens into a random item.',
    icon: null,
  },
}

let catalogue = new Map<Item, ItemEntry>()

/** Adopts the served catalogue; it is loaded with the board, before anything is shown. */
export function useItemCatalogue(served: ReadonlyMap<Item, ItemEntry>) {
  catalogue = new Map(served)
}

export const itemEntry = (item: Item): ItemEntry => catalogue.get(item) ?? FALLBACK_CATALOGUE[item]

/** Items that do nothing when used; they work by being held. */
export const PASSIVE_ITEMS: ReadonlySet<Item> = new Set<Item>([
  'protect_from_magic',
  ...Object.values(NECKLACES),
])

/**
 * Shop prices, always the listed price. The API does not serve the shop yet, so these mirror the
 * backend's `config/sample/game.toml`; the server's price wins when they differ.
 */
export const SHOP_PRICES: Partial<Record<Item, number>> = {
  bronze_feather: 40,
  silver_feather: 80,
  gold_feather: 100,
  harp_of_rain: 30,
  quetzal_whistle: 20,
  ogre_boat: 20,
  group_teleport: 50,
  banana: 10,
  harpie_bug_swarm: 10,
  snake_charmer: 10,
  wilderness_web: 10,
  ice_barrage: 30,
  entangle: 20,
  protect_from_magic: 20,
  leprechaun_hat: 30,
  saturated_heart: 30,
  sapphire_necklace: 30,
  emerald_necklace: 30,
  dragon_necklace: 30,
  ruby_necklace: 30,
  gold_necklace: 30,
  zenyte_necklace: 30,
  topaz_necklace: 30,
  diamond_necklace: 30,
  mystery_box: 40,
}

export const INVENTORY_LIMIT = 10

export const inventorySize = (team: Team) => [...team.items.values()].reduce((a, b) => a + b, 0)

/** What an item acts on, so captains can see at a glance what a power-up is for. */
export type ItemGroup = 'draw' | 'you' | 'rival' | 'board' | 'everyone' | 'held'

export const ITEM_GROUPS: Record<ItemGroup, { label: string; hint: string }> = {
  draw: { label: 'Your draw', hint: 'Changes the card you are about to draw' },
  you: { label: 'Your token', hint: 'Moves your own piece' },
  rival: { label: 'A rival', hint: 'Slows or freezes another team' },
  board: { label: 'The board', hint: 'Leaves a trap or a web on a tile near you' },
  everyone: { label: 'Everyone', hint: 'Affects every team at once' },
  held: { label: 'Kept', hint: 'Works by being held; nothing to use' },
}

export const ITEM_GROUP: Record<Item, ItemGroup> = {
  bronze_feather: 'draw',
  silver_feather: 'draw',
  gold_feather: 'draw',
  harp_of_rain: 'rival',
  quetzal_whistle: 'you',
  ogre_boat: 'you',
  group_teleport: 'everyone',
  banana: 'board',
  harpie_bug_swarm: 'board',
  snake_charmer: 'board',
  wilderness_web: 'board',
  ice_barrage: 'rival',
  entangle: 'rival',
  protect_from_magic: 'held',
  leprechaun_hat: 'draw',
  saturated_heart: 'draw',
  sapphire_necklace: 'held',
  emerald_necklace: 'held',
  dragon_necklace: 'held',
  ruby_necklace: 'held',
  gold_necklace: 'held',
  zenyte_necklace: 'held',
  topaz_necklace: 'held',
  diamond_necklace: 'held',
  mystery_box: 'you',
}

/**
 * Why the team cannot use an item right now, or null if it can. Mirrors the server's rule
 * (`use_item` in docs/api.md): power-ups are a decision taken between finishing a tile and drawing,
 * one per tile, never while frozen or in a match. `here` is the team's tile, for the items that
 * only work on land or at sea.
 */
export function whyNotUsable(team: Team, item: Item, now: Date, here?: Tile): string | null {
  if (PASSIVE_ITEMS.has(item)) return 'Works while held'
  if (here && item === 'quetzal_whistle' && here.sea) return 'Only works on land'
  if (here && item === 'ogre_boat' && !here.sea) return 'Only works at sea'
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
