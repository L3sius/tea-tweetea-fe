import { z } from 'zod'
import { GEMS } from '@/domain/vocabulary'
import { Id, TileKind } from './primitives'

export const WireTile = z.object({
  id: Id,
  x: z.int(),
  y: z.int(),
  kind: TileKind,
  /** Index into `continents`. */
  continent: z
    .int()
    .min(0)
    .max(GEMS.length - 1),
  /** Water: some items only work on land or at sea. */
  sea: z.boolean(),
})

export const WireBoard = z.object({
  tiles: z.array(WireTile),
  roads: z.array(z.tuple([Id, Id])),
  /** Tiles where a gem may be placed; each game picks one per continent. */
  gem_spots: z.array(Id),
  /** One continent per gem, in gem order. */
  continents: z.array(z.string()).length(GEMS.length),
})
export type WireBoard = z.infer<typeof WireBoard>
