// Which OSRS animations pieces play. roster.json is the one list both the app and
// tools/characters/export.mjs read: the export ships every animation it names.
//
// - Styles: what a team picks for itself, how its character stands, walks, runs and swims.
// - Reactions: animations for moments on the board, picked from a pool when they happen.
// - Easter eggs: rare idle emotes, and the odd walk in someone else's style.
import type { Appearance } from '@/domain/game'
import type { ReactionKind } from '@/domain/motion'
import rosterJson from './roster.json'

export const STYLES = ['idle', 'walk', 'run', 'swim'] as const
export type Style = (typeof STYLES)[number]

export type StyleOption = { id: number; label: string }

type Roster = {
  styles: Record<Style, StyleOption[]>
  reactions: Record<ReactionKind | 'frozen' | 'pass', number[]>
  easterEggs: { idle: number[]; idleChancePerMinute: number; gaitChancePerWalk: number }
  featured: number[]
}

export const ROSTER = rosterJson as Roster

/** A team's appearance holds one animation per style. */
export type { Appearance }

/**
 * Stored instead of an animation id for a style that picks a new option from its pool on every
 * move. The game has no animation 0 in the roster, and the backend keeps whatever id it is sent.
 */
export const RANDOM = 0

/** The styles a team may leave to chance: the ones that play while moving. */
export const RANDOM_STYLES: readonly Style[] = ['walk', 'run', 'swim']

/** The animation ids a style offers. */
export const optionIds = (style: Style) => ROSTER.styles[style].map((o) => o.id)

/** Walks of at least this many steps run. */
export const RUN_FROM_STEPS = 7

/** The first option of every style, on `npc`. */
export function defaultAppearance(npc: number = ROSTER.featured[0] ?? 3106): Appearance {
  const first = (style: Style) => ROSTER.styles[style][0]?.id ?? 808
  return { npc, idle: first('idle'), walk: first('walk'), run: first('run'), swim: first('swim') }
}
