import type { TileId } from './ids'
import type { Gem, TileKind } from './vocabulary'

export type Tile = {
  id: TileId
  /** OSRS world coordinates. */
  x: number
  y: number
  kind: TileKind
  /** The gem of the continent the tile belongs to. */
  continent: Gem
  /** On water: the Ogre boat works here, the Quetzal whistle doesn't. */
  sea: boolean
}

export type Road = readonly [TileId, TileId]

export type Continent = {
  name: string
  gem: Gem
  /** Tiles where this continent's gem may be placed; each game picks one. */
  gemSpots: TileId[]
}

export type Board = {
  tiles: Map<TileId, Tile>
  /** Undirected road segments between neighbouring tiles. */
  roads: Road[]
  continents: Continent[]
}
