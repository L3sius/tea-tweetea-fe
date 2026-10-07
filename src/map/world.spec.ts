import { describe, expect, it } from 'vitest'
import { terrainScene, toMapPixel, worldMap } from './world'

describe('toMapPixel', () => {
  it('puts the top-left world tile at the top-left corner', () => {
    const { px, py } = toMapPixel(worldMap, worldMap.xMin, worldMap.yMax)
    expect(px).toBeCloseTo(0.25)
    expect(py).toBeCloseTo(0.25)
  })

  it('moves right with x and down as y falls', () => {
    // Lumbridge, which sits in the middle of the map.
    const { px, py } = toMapPixel(worldMap, 3222, 3218)
    expect(px).toBeGreaterThan(0)
    expect(px).toBeLessThan(worldMap.width)
    expect(py).toBeGreaterThan(0)
    expect(py).toBeLessThan(worldMap.height)
    expect(Math.floor(px)).toBe((3222 - worldMap.xMin) / worldMap.tilesPerPixel)
  })
})

describe('terrainScene', () => {
  it('names the cut by the tile’s world position', () => {
    expect(terrainScene({ x: 2386, y: 3747 })).toMatch(/terrain\/2386_3747\.webp$/)
  })
})
