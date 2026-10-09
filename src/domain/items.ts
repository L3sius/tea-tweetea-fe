// What each item does and what it is used on, from the server's rules (`src/engine/items.rs`).
import type { Tile } from './board'
import type { Blocker, Team } from './game'
import type { TeamId, TileId } from './ids'
import { ITEMS, type Item } from './vocabulary'

const TARGETS: Partial<Record<Item, ItemTargetKind>> = {
  morrigans_throwing_axe: 'team',
  ice_barrage: 'team',
  entangle: 'team',
  banana: 'tile',
  harpie_bug_swarm: 'tile',
  snake_charmer: 'tile',
  wilderness_web: 'tile',
}

/** `team`: a rival team. `tile`: a free tile within the rules' blocker range. */
export type ItemTargetKind = 'none' | 'team' | 'tile'

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

/** An item as the catalogue (`GET /items`) describes it, numbers included. */
export type ItemEntry = {
  name: string
  description: string
  /** Image URL, typically from the OSRS Wiki. */
  icon: string | null
  /** Gold, at any shop that stocks it. */
  price: number
  /** How long the item freezes a team: blockers, Ice Barrage, Entangle. */
  freezeHours: number | null
  /** The factor a feather applies to the next move. */
  multiplier: number | null
}

/** `GET /items`: every item, plus the mystery box, which every shop sells but is not an item. */
export type ItemCatalogue = { items: Map<Item, ItemEntry>; mysteryBox: ItemEntry }

/**
 * Stands in for an entry the catalogue lacks. The catalogue loads with the board, before anything
 * is shown, so this only covers an item the server stopped describing. It copies no numbers.
 */
const placeholder = (name: string): ItemEntry => ({
  name,
  description: '',
  icon: null,
  price: 0,
  freezeHours: null,
  multiplier: null,
})

/** "harpie_bug_swarm" -> "Harpie bug swarm". */
const fromId = (id: string) => id.charAt(0).toUpperCase() + id.slice(1).replaceAll('_', ' ')

let catalogue: ItemCatalogue = { items: new Map(), mysteryBox: placeholder('Mystery box') }

/** Adopts the served catalogue; it is loaded with the board, before anything is shown. */
export function useItemCatalogue(served: ItemCatalogue) {
  catalogue = { items: new Map(served.items), mysteryBox: served.mysteryBox }
}

export const itemEntry = (item: Item): ItemEntry =>
  catalogue.items.get(item) ?? placeholder(fromId(item))

export const mysteryBoxEntry = (): ItemEntry => catalogue.mysteryBox

/** Items that do nothing when used; they work by being held. */
export const PASSIVE_ITEMS: ReadonlySet<Item> = new Set<Item>(['protect_from_magic'])

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
}

/**
 * Why the team cannot use an item right now, or null if it can. Mirrors the server's rule
 * (`use_item` in docs/api.md): power-ups are a decision taken between finishing a tile and drawing,
 * one per tile, never while frozen. `here` is the team's tile, for the items that
 * only work on land or at sea; `blockers` is how many the team has out against its limit.
 */
export function whyNotUsable(
  team: Team,
  item: Item,
  now: Date,
  here?: Tile,
  blockers?: { placed: number; limit: number },
): string | null {
  if (PASSIVE_ITEMS.has(item)) return 'Works while held'
  if (ITEM_TARGET[item] === 'tile' && blockers && blockers.placed >= blockers.limit)
    return `You already have ${blockers.limit} blockers out`
  if (here && item === 'quetzal_whistle' && here.sea) return 'Only works on land'
  if (here && item === 'ogre_boat' && !here.sea) return 'Only works at sea'
  if (team.frozenUntil !== null && team.frozenUntil > now) return 'Not while frozen'
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
