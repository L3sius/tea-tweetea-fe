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

export const ITEMS = [
  'owls_feather',
  'migrant_bird',
  'phoenix_feather',
  'harp_of_rain',
  'bird_whistle',
  'whale_whistle',
  'turtle_whistle',
  'royal_ring',
  'banana_peel',
  'bee_whistle',
  'snake_whistle',
  'giants_lamp',
  'sleeping_potion',
  'monks_ring',
  'monks_pendant',
  'club_hat',
  'heart_glove',
  'diamond_boot',
  'spade_boot',
  'blue_bell',
  'green_bell',
  'purple_bell',
  'red_bell',
  'yellow_bell',
  'orange_bell',
  'pink_bell',
  'white_bell',
  'mystery_box',
] as const
export type Item = (typeof ITEMS)[number]
