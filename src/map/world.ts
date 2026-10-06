import meta from '@/assets/map/world.json'
import imageUrl from '@/assets/map/world.png'

/** How the pixel-art world map lines up with OSRS world tiles (copied from the backend). */
export type WorldMap = {
  imageUrl: string
  width: number
  height: number
  tilesPerPixel: number
  xMin: number
  yMax: number
}

export const worldMap: WorldMap = {
  imageUrl,
  width: meta.width,
  height: meta.height,
  tilesPerPixel: meta.tiles_per_pixel,
  xMin: meta.x_min,
  yMax: meta.y_max,
}

/**
 * The map's coordinate system is OSRS world tiles: `lat` is world y and `lng` world x, with the
 * tile's centre at `+0.5`. One world tile is one screen pixel at zoom 0, which lines up with
 * Explv's map tiles (see `explvTileUrl`).
 */
export const tileCentre = (x: number, y: number) => ({ lat: y + 0.5, lng: x + 0.5 })

/** The pixel-art image's corners, as `[south-west, north-east]` in world coordinates. */
export function imageBounds(map: WorldMap): [[number, number], [number, number]] {
  const t = map.tilesPerPixel
  const top = map.yMax + 1
  return [
    [top - map.height * t, map.xMin],
    [top, map.xMin + map.width * t],
  ]
}

/** Leaflet's pixel origin for the world-tile CRS: x from world 960, y down from world 17600. */
export const CRS_ORIGIN = { x: 960, y: 17600 } as const

const EXPLV = 'https://raw.githubusercontent.com/Explv/osrs_map_tiles/master/0'

/** Explv's detailed map tile for a Leaflet tile coordinate in the world-tile CRS (TMS rows). */
export function explvTileUrl(coords: { x: number; y: number; z: number }): string {
  const z = coords.z + 6
  return `${EXPLV}/${z}/${coords.x}/${(1 << z) - 1 - coords.y}.png`
}

/**
 * The image pixel (fractional, from the top left) at the centre of a world tile. Pixel `(px, py)`
 * covers world x from `xMin + px*t` and world y down from `yMax - py*t`.
 */
export function toMapPixel(map: WorldMap, x: number, y: number): { px: number; py: number } {
  const t = map.tilesPerPixel
  return { px: (x + 0.5 - map.xMin) / t, py: (map.yMax + 0.5 - y) / t }
}
