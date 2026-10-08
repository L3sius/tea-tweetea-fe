import type { Team } from '@/domain/game'
import type { Gem, TileKind } from '@/domain/vocabulary'

/** The bright tint of each gem sprite (design tokens `--gem-*-glow`), for dots and outlines. */
export const GEM_COLORS: Record<Gem, string> = {
  blue: '#4a5cff',
  green: '#3cbc27',
  purple: '#b45cff',
  red: '#ff3a1f',
  yellow: '#ffff00',
  orange: '#ff981f',
  pink: '#ff4fb0',
  white: '#ffffff',
}

/** Tile squares on the map, as in the design system's event site. */
export const TILE_COLORS: Record<TileKind, string> = {
  normal: '#e8dcb8',
  red: '#ff0000',
  shop: '#ffb000',
}

// The OSRS text palette, so team names read like in-game text.
const NAMED: Record<string, string> = {
  red: '#ff0000',
  blue: '#4a5cff',
  green: '#00ff00',
  gold: '#ffb000',
  yellow: '#ffff00',
  purple: '#b45cff',
  orange: '#ff981f',
  pink: '#ff4fb0',
}

/**
 * For teams not named after a colour, which is most real names: by id, in an order where the first
 * teams differ most (red, blue, green, gold before the rest).
 */
const FALLBACK = [
  '#ff3a1f',
  '#4a8cff',
  '#00ff00',
  '#ffb000',
  '#b45cff',
  '#00ffff',
  '#ff4fb0',
  '#ff981f',
  '#ffffff',
]

/** A team named after a colour wears it; any other team gets a stable colour by id. */
export function teamColor(team: Pick<Team, 'id' | 'name'>): string {
  return NAMED[team.name.toLowerCase()] ?? FALLBACK[team.id % FALLBACK.length] ?? '#c8c0a8'
}
