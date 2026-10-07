import type { Board, Continent, Tile } from '@/domain/board'
import { tileId } from '@/domain/ids'
import { GEMS, type Gem } from '@/domain/vocabulary'
import type { WireBoard } from '../wire/board'
import { byGemOrder } from './shared'

export function toBoard(wire: WireBoard): Board {
  const tiles = new Map(
    wire.tiles.map((tile): [Tile['id'], Tile] => [
      tileId(tile.id),
      {
        id: tileId(tile.id),
        x: tile.x,
        y: tile.y,
        kind: tile.kind,
        // The schema bounds the index to the eight continents.
        continent: GEMS[tile.continent] as Gem,
        sea: tile.sea,
      },
    ]),
  )
  const continents = [...byGemOrder(wire.continents)].map(([gem, name]): Continent => ({
    name,
    gem,
    gemSpots: wire.gem_spots.map(tileId).filter((spot) => tiles.get(spot)?.continent === gem),
  }))
  return {
    tiles,
    roads: wire.roads.map(([a, b]) => [tileId(a), tileId(b)] as const),
    continents,
  }
}
