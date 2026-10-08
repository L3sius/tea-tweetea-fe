// How a tile's tooltip scene looks, worked out from the tile's own data: land or sea picks the
// environment, frame and header style; the region picks the colour and crests; the kind picks its
// colour and a note. The scene component only draws what this returns.
import frameBloody from '@/assets/tt/img/scene/frame-bloody.png'
import frameCrystal from '@/assets/tt/img/scene/frame-crystal.png'
import frameJungle from '@/assets/tt/img/scene/frame-jungle.png'
import frameLand from '@/assets/tt/img/scene/frame-land.png'
import frameMarble from '@/assets/tt/img/scene/frame-marble.png'
import frameSandy from '@/assets/tt/img/scene/frame-sandy.png'
import frameSea from '@/assets/tt/img/scene/frame-sea.png'
import frameTerracotta from '@/assets/tt/img/scene/frame-terracotta.png'
import frameVolcanic from '@/assets/tt/img/scene/frame-volcanic.png'
import type { TileKind } from '@/domain/vocabulary'
import { regionLook, type FrameStyle } from './regions'

export type Environment = 'land' | 'sea'

export type TileTheme = {
  environment: Environment
  /**
   * How the region is named: on a cloth banner in the region's colour over land, or straight onto
   * the water at sea, its crests flying from poles.
   */
  header: 'cloth' | 'open'
  /** A 9-slice frame image; `slice` is in the image's own pixels (drawn at 2x). */
  frame: { url: string; slice: number }
  /** The first region's colour. */
  colour: string
  /** One crest per region the continent covers. */
  crests: string[]
  /** The kind's colour, as its marker on the map, and a line about it when it matters. */
  kind: { colour: string; note: string | null }
}

const ENVIRONMENTS: Record<Environment, Pick<TileTheme, 'header' | 'frame'>> = {
  land: { header: 'cloth', frame: { url: frameLand, slice: 16 } },
  sea: { header: 'open', frame: { url: frameSea, slice: 16 } },
}

/** Each region's own land frame: the Wilderness volcanic, Morytania bloody, the Desert sandy … */
const LAND_FRAMES: Record<FrameStyle, string> = {
  volcanic: frameVolcanic,
  bloody: frameBloody,
  sandy: frameSandy,
  terracotta: frameTerracotta,
  jungle: frameJungle,
  marble: frameMarble,
  crystal: frameCrystal,
}

/** Coloured like the tile's marker on the map. */
const KINDS: Record<TileKind, TileTheme['kind']> = {
  normal: { colour: '#e8dcb8', note: null },
  red: {
    colour: '#ff0000',
    note: 'Minigame! Landing here starts a random minigame for every team.',
  },
  shop: { colour: '#ffb000', note: 'Teams passing through can shop here.' },
}

export function tileTheme(tile: { sea: boolean; kind: TileKind }, regionName: string): TileTheme {
  const environment: Environment = tile.sea ? 'sea' : 'land'
  const region = regionLook(regionName)
  const base = ENVIRONMENTS[environment]
  const landFrame = environment === 'land' && region.frame ? LAND_FRAMES[region.frame] : null
  return {
    environment,
    header: base.header,
    frame: landFrame ? { url: landFrame, slice: 16 } : base.frame,
    colour: region.colour,
    crests: region.badges,
    kind: KINDS[tile.kind],
  }
}
