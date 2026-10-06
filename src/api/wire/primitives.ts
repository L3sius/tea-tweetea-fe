import { z } from 'zod'
import { CLUE_TIERS, GEMS, ITEMS, PHASES, SUITS, TILE_KINDS } from '@/domain/vocabulary'

export const Id = z.int().nonnegative()
export const Timestamp = z.iso.datetime()

export const Gem = z.enum(GEMS)
export const Suit = z.enum(SUITS)
export const Item = z.enum(ITEMS)
export const TileKind = z.enum(TILE_KINDS)
export const Phase = z.enum(PHASES)
export const ClueTier = z.enum(CLUE_TIERS)

/**
 * JSON object keys are always strings, so maps keyed by a numeric id arrive as `{ "17": ... }`.
 * Validating the keys here lets the mappers convert them with `Number` safely.
 */
export const idKeyed = <T extends z.ZodType>(value: T) => z.record(z.string().regex(/^\d+$/), value)
