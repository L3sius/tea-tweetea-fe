// The game's fixed vocabulary. Values match the rulebook and the API, so they pass through the
// mappers unchanged.

/** Gem order matters: continents and gem tiles are indexed in this order. */
export const GEMS = ['blue', 'green', 'purple', 'red', 'yellow', 'orange', 'pink', 'white'] as const
export type Gem = (typeof GEMS)[number]

export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const
export type Suit = (typeof SUITS)[number]

export const TILE_KINDS = ['normal', 'red', 'shop'] as const
export type TileKind = (typeof TILE_KINDS)[number]

export const PHASES = ['setup', 'running', 'ended'] as const
export type Phase = (typeof PHASES)[number]

export const CLUE_TIERS = ['any', 'beginner', 'easy', 'medium', 'hard', 'elite', 'master'] as const
export type ClueTier = (typeof CLUE_TIERS)[number]

export const CA_TIERS = ['easy', 'medium', 'hard', 'elite', 'master', 'grandmaster'] as const
export type CaTier = (typeof CA_TIERS)[number]

export const ITEMS = [
  'bronze_feather',
  'silver_feather',
  'gold_feather',
  'morrigans_throwing_axe',
  'quetzal_whistle',
  'ogre_boat',
  'group_teleport',
  'banana',
  'harpie_bug_swarm',
  'snake_charmer',
  'wilderness_web',
  'ice_barrage',
  'entangle',
  'protect_from_magic',
  'leprechaun_hat',
  'saturated_heart',
] as const
export type Item = (typeof ITEMS)[number]
