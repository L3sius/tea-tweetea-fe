import type { Team } from '@/domain/game'
import type { Gem, TileKind } from '@/domain/vocabulary'

export const GEM_COLORS: Record<Gem, string> = {
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#a855f7',
  red: '#ef4444',
  yellow: '#facc15',
  orange: '#f97316',
  pink: '#ec4899',
  white: '#f1f5f9',
}

export const TILE_COLORS: Record<TileKind, string> = {
  normal: '#e2e8f0',
  red: '#dc2626',
  shop: '#f59e0b',
}

const NAMED: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  gold: '#eab308',
  yellow: '#eab308',
  purple: '#a855f7',
  orange: '#f97316',
  pink: '#ec4899',
}

const FALLBACK = ['#06b6d4', '#84cc16', '#f43f5e', '#8b5cf6', '#14b8a6', '#fb923c']

/** A team named after a colour wears it; any other team gets a stable colour by id. */
export function teamColor(team: Pick<Team, 'id' | 'name'>): string {
  return NAMED[team.name.toLowerCase()] ?? FALLBACK[team.id % FALLBACK.length] ?? '#94a3b8'
}
