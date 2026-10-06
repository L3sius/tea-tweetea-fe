import { z } from 'zod'
import { GEMS } from '@/domain/vocabulary'
import { Id, TileKind } from './primitives'

export const WireTile = z.object({ id: Id, x: z.int(), y: z.int(), kind: TileKind })

export const WireBoard = z.object({
  tiles: z.array(WireTile),
  roads: z.array(z.tuple([Id, Id])),
  gem_spots: z.array(z.object({ tile: Id, continent: z.string() })),
  /** One continent per gem, in gem order. */
  continents: z.array(z.string()).length(GEMS.length),
})
export type WireBoard = z.infer<typeof WireBoard>
