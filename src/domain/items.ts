// What each item does and what it is used on, from the server's rules (`src/engine/items.rs`).
import type { Tile } from './board'
import type { Blocker, Team } from './game'
import type { TeamId, TileId } from './ids'
import { ITEMS, NECKLACES, type Item } from './vocabulary'

const TARGETS: Partial<Record<Item, ItemTargetKind>> = {
  morrigans_throwing_axe: 'team',
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

/** How many blockers a team may have on the board at once (`blockers_per_team`). */
export const BLOCKERS_PER_TEAM = 2

/** Hours a blocker freezes the team it catches (`blocker_hours` in the game config). */
export const BLOCKER_FREEZE_HOURS: Partial<Record<Item, number>> = {
  banana: 0.5,
  harpie_bug_swarm: 1,
  snake_charmer: 2,
  wilderness_web: 4,
}

/** The blockers a team has on the board that have not worn off by `now`. */
export function blockersOut(
  blockers: ReadonlyMap<TileId, Blocker>,
  team: TeamId,
  now: Date,
): number {
  let n = 0
  for (const b of blockers.values()) if (b.owner === team && b.until > now) n++
  return n
}

/** What each item is used on, from the server's `apply_item`. */
export const ITEM_TARGET: Record<Item, ItemTargetKind> = Object.fromEntries(
  ITEMS.map((item) => [item, TARGETS[item] ?? 'none']),
) as Record<Item, ItemTargetKind>

/** Hostile items: their target is shielded from further hostile items for a while after a hit. */
export const HOSTILE_ITEMS: ReadonlySet<Item> = new Set<Item>([
  'morrigans_throwing_axe',
  'ice_barrage',
  'entangle',
])

/** An item as the catalogue (`GET /items`) describes it. */
export type ItemEntry = {
  name: string
  description: string
  /** Image URL, typically from the OSRS Wiki. */
  icon: string | null
  /** Gold, at any shop that stocks it. */
  price: number
}

/** `GET /items`: every item, plus the mystery box, which every shop sells but is not an item. */
export type ItemCatalogue = { items: Map<Item, ItemEntry>; mysteryBox: ItemEntry }

/**
 * The server's catalogue as of writing, so items read well before `/items` arrives or if it fails.
 * The served catalogue replaces it (`useItemCatalogue`); keep it in step with `config/items.toml`.
 */
const FALLBACK_CATALOGUE: Record<Item, ItemEntry> = {
  bronze_feather: {
    name: 'Bronze feather',
    description: 'Your next move is 1.5 times as long (rounded).',
    icon: 'https://oldschool.runescape.wiki/images/Bronze_feather.png',
    price: 40,
  },
  silver_feather: {
    name: 'Silver feather',
    description: 'Your next move is twice as long.',
    icon: 'https://oldschool.runescape.wiki/images/Silver_feather.png',
    price: 80,
  },
  gold_feather: {
    name: 'Gold feather',
    description: 'Your next move is 2.5 times as long (rounded).',
    icon: null,
    price: 100,
  },
  morrigans_throwing_axe: {
    name: "Morrigan's throwing axe",
    description:
      "Halves a rival team's next move. Hostile: the target is then shielded for 12 hours.",
    icon: 'https://oldschool.runescape.wiki/images/Morrigan%27s_throwing_axe.png',
    price: 30,
  },
  quetzal_whistle: {
    name: 'Quetzal whistle',
    description: 'On land only: fly to a random land tile away from the gems.',
    icon: 'https://oldschool.runescape.wiki/images/Perfected_quetzal_whistle.png',
    price: 20,
  },
  ogre_boat: {
    name: 'Ogre boat',
    description: 'At sea only: sail to a random sea tile away from the gems.',
    icon: 'https://oldschool.runescape.wiki/images/thumb/Ogre_boat.png/300px-Ogre_boat.png',
    price: 20,
  },
  group_teleport: {
    name: 'Group teleport',
    description: 'Sends every team that is not moving or in a match to a random shop.',
    icon: 'https://oldschool.runescape.wiki/images/Ice_plateau_teleport_%28tablet%29.png',
    price: 50,
  },
  banana: {
    name: 'Banana',
    description:
      'Blocker for a tile up to 10 tiles away, for 24 hours. Every team that walks onto it, yours included, stops there, loses the rest of its move and is frozen for 30 minutes.',
    icon: 'https://oldschool.runescape.wiki/images/Banana.png',
    price: 10,
  },
  harpie_bug_swarm: {
    name: 'Harpie bug swarm',
    description:
      'Blocker for a tile up to 10 tiles away, for 24 hours. Every team that walks onto it, yours included, stops there, loses the rest of its move and is frozen for 1 hour.',
    icon: 'https://oldschool.runescape.wiki/images/Harpie_Bug_Swarm.png',
    price: 15,
  },
  snake_charmer: {
    name: 'Snake charmer',
    description:
      'Blocker for a tile up to 10 tiles away, for 24 hours. Every team that walks onto it, yours included, stops there, loses the rest of its move and is frozen for 2 hours.',
    icon: 'https://oldschool.runescape.wiki/images/thumb/Ali_the_Snake_Charmer.png/180px-Ali_the_Snake_Charmer.png',
    price: 25,
  },
  wilderness_web: {
    name: 'Wilderness web',
    description:
      'Blocker for a tile up to 10 tiles away, for 24 hours. Every team that walks onto it, yours included, stops there, loses the rest of its move and is frozen for 4 hours.',
    icon: 'https://oldschool.runescape.wiki/images/Web.png',
    price: 40,
  },
  ice_barrage: {
    name: 'Ice Barrage',
    description:
      'Freezes a rival team for 6 hours. Hostile: the target is then shielded for 12 hours.',
    icon: 'https://oldschool.runescape.wiki/images/Ice_Barrage.png',
    price: 30,
  },
  entangle: {
    name: 'Entangle',
    description:
      'Freezes a rival team for 3 hours. Hostile: the target is then shielded for 12 hours.',
    icon: 'https://oldschool.runescape.wiki/images/Entangle.png',
    price: 20,
  },
  protect_from_magic: {
    name: 'Protect from Magic',
    description: 'Passive: blocks the next freeze on your team, then is used up.',
    icon: 'https://oldschool.runescape.wiki/images/Protect_from_Magic.png',
    price: 20,
  },
  leprechaun_hat: {
    name: 'Leprechaun hat',
    description: 'For your next 5 draws, a club pays gold.',
    icon: 'https://oldschool.runescape.wiki/images/Leprechaun_hat.png',
    price: 30,
  },
  saturated_heart: {
    name: 'Saturated heart',
    description: 'For your next 5 draws, a heart pays gold.',
    icon: 'https://oldschool.runescape.wiki/images/Saturated_heart.png',
    price: 30,
  },
  sapphire_necklace: {
    name: 'Sapphire necklace',
    description: 'Passive: protects your blue gem when you lose a match.',
    icon: 'https://oldschool.runescape.wiki/images/Sapphire_necklace.png',
    price: 30,
  },
  emerald_necklace: {
    name: 'Emerald necklace',
    description: 'Passive: protects your green gem when you lose a match.',
    icon: 'https://oldschool.runescape.wiki/images/Emerald_necklace.png',
    price: 30,
  },
  dragon_necklace: {
    name: 'Dragon necklace',
    description: 'Passive: protects your purple gem when you lose a match.',
    icon: 'https://oldschool.runescape.wiki/images/Dragon_necklace.png',
    price: 30,
  },
  ruby_necklace: {
    name: 'Ruby necklace',
    description: 'Passive: protects your red gem when you lose a match.',
    icon: 'https://oldschool.runescape.wiki/images/Ruby_necklace.png',
    price: 30,
  },
  onyx_necklace: {
    name: 'Onyx necklace',
    description: 'Passive: protects your yellow gem when you lose a match.',
    icon: 'https://oldschool.runescape.wiki/images/Onyx_necklace.png',
    price: 30,
  },
  zenyte_necklace: {
    name: 'Zenyte necklace',
    description: 'Passive: protects your orange gem when you lose a match.',
    icon: 'https://oldschool.runescape.wiki/images/Zenyte_necklace.png',
    price: 30,
  },
  topaz_necklace: {
    name: 'Topaz necklace',
    description: 'Passive: protects your pink gem when you lose a match.',
    icon: 'https://oldschool.runescape.wiki/images/Topaz_necklace.png',
    price: 30,
  },
  diamond_necklace: {
    name: 'Diamond necklace',
    description: 'Passive: protects your white gem when you lose a match.',
    icon: 'https://oldschool.runescape.wiki/images/Diamond_necklace.png',
    price: 30,
  },
}

const FALLBACK_MYSTERY_BOX: ItemEntry = {
  name: 'Mystery box',
  description: 'Sold in every shop. A random item goes straight into your inventory.',
  icon: null,
  price: 40,
}

let catalogue: ItemCatalogue = { items: new Map(), mysteryBox: FALLBACK_MYSTERY_BOX }

/** Adopts the served catalogue; it is loaded with the board, before anything is shown. */
export function useItemCatalogue(served: ItemCatalogue) {
  catalogue = { items: new Map(served.items), mysteryBox: served.mysteryBox }
}

export const itemEntry = (item: Item): ItemEntry =>
  catalogue.items.get(item) ?? FALLBACK_CATALOGUE[item]

export const mysteryBoxEntry = (): ItemEntry => catalogue.mysteryBox

/** Items that do nothing when used; they work by being held. */
export const PASSIVE_ITEMS: ReadonlySet<Item> = new Set<Item>([
  'protect_from_magic',
  ...Object.values(NECKLACES),
])

export const INVENTORY_LIMIT = 10

export const inventorySize = (items: ReadonlyMap<Item, number>) =>
  [...items.values()].reduce((a, b) => a + b, 0)

/** The item an inventory gained between two readings, if one did. */
export function gainedItem(
  before: ReadonlyMap<Item, number>,
  after: ReadonlyMap<Item, number>,
): Item | null {
  for (const [item, count] of after) if (count > (before.get(item) ?? 0)) return item
  return null
}

/** What an item acts on, so captains can see at a glance what a power-up is for. */
export type ItemGroup = 'draw' | 'you' | 'rival' | 'board' | 'everyone' | 'held'

export const ITEM_GROUPS: Record<ItemGroup, { label: string; hint: string }> = {
  draw: { label: 'Your draw', hint: 'Changes the card you are about to draw' },
  you: { label: 'Your token', hint: 'Moves your own piece' },
  rival: { label: 'A rival', hint: 'Slows or freezes another team' },
  board: { label: 'The board', hint: 'Leaves a blocker on a tile near you' },
  everyone: { label: 'Everyone', hint: 'Affects every team at once' },
  held: { label: 'Kept', hint: 'Works by being held; nothing to use' },
}

export const ITEM_GROUP: Record<Item, ItemGroup> = {
  bronze_feather: 'draw',
  silver_feather: 'draw',
  gold_feather: 'draw',
  morrigans_throwing_axe: 'rival',
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
  onyx_necklace: 'held',
  zenyte_necklace: 'held',
  topaz_necklace: 'held',
  diamond_necklace: 'held',
}

/**
 * Why the team cannot use an item right now, or null if it can. Mirrors the server's rule
 * (`use_item` in docs/api.md): power-ups are a decision taken between finishing a tile and drawing,
 * one per tile, never while frozen or in a match. `here` is the team's tile, for the items that
 * only work on land or at sea; `placed` is how many blockers the team has out.
 */
export function whyNotUsable(
  team: Team,
  item: Item,
  now: Date,
  here?: Tile,
  placed = 0,
): string | null {
  if (PASSIVE_ITEMS.has(item)) return 'Works while held'
  if (BLOCKER_FREEZE_HOURS[item] !== undefined && placed >= BLOCKERS_PER_TEAM)
    return `You already have ${BLOCKERS_PER_TEAM} blockers out`
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
