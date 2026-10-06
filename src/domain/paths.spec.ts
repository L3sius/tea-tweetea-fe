import { describe, expect, it } from 'vitest'
import { tileId, type TileId } from './ids'
import { adjacency, nearestTile, tilesWithin, Walks } from './paths'

const t = (...ids: number[]) => ids.map(tileId)
const road = (a: number, b: number) => [tileId(a), tileId(b)] as const

// 0 - 1 - 2 - 3
//     |       |
//     4 - 5 - 6     plus a dead end 2 - 7
const adj = adjacency([
  road(0, 1),
  road(1, 2),
  road(2, 3),
  road(1, 4),
  road(4, 5),
  road(5, 6),
  road(6, 3),
  road(2, 7),
])
const none = new Set<TileId>()

/** Checks a path follows the server's rule. */
function isValid(path: TileId[], length: number, rocks = none) {
  if (path.length !== length + 1) return false
  for (const [i, tile] of path.entries()) {
    if (i === 0) continue
    if (!adj.get(path[i - 1] ?? tile)?.includes(tile)) return false
    if (i >= 2 && tile === path[i - 2]) return false
    if (rocks.has(tile)) return false
  }
  return true
}

describe('Walks', () => {
  it('finds every tile a walk can end on', () => {
    const { ends } = new Walks(adj, none, tileId(0), 3).reach()
    expect([...ends].sort()).toEqual(t(3, 5, 7).sort())
  })

  it('never turns straight back, so dead ends are not destinations', () => {
    // From 0 in 4 steps: 0-1-2-7 is a dead end and cannot continue.
    const { ends } = new Walks(adj, none, tileId(0), 4).reach()
    expect(ends.has(tileId(2))).toBe(false)
    expect([...ends].sort()).toEqual(t(6).sort())
  })

  it('builds a valid walk ending on a destination', () => {
    const walks = new Walks(adj, none, tileId(0), 3)
    const path = walks.endingAt(tileId(5))
    expect(path).toEqual(t(0, 1, 4, 5))
    expect(walks.endingAt(tileId(6))).toBeNull()
  })

  it('builds a valid walk through a waypoint', () => {
    const walks = new Walks(adj, none, tileId(0), 5)
    const path = walks.through(tileId(5))
    expect(path).toContain(tileId(5))
    expect(isValid(path ?? [], 5)).toBe(true)
  })

  it('routes around rocks', () => {
    const rocks = new Set(t(4))
    const walks = new Walks(adj, rocks, tileId(0), 4)
    const path = walks.through(tileId(6))
    expect(path).toEqual(t(0, 1, 2, 3, 6))
    expect(walks.through(tileId(4))).toBeNull()
  })
})

describe('nearestTile', () => {
  it('picks the closest candidate', () => {
    const at = (tile: TileId) => ({ x: tile * 10, y: 0 })
    expect(nearestTile(t(0, 1, 2), at, { x: 14, y: 3 })).toBe(1)
  })
})

describe('tilesWithin', () => {
  it('counts road steps', () => {
    expect([...tilesWithin(adj, tileId(0), 2)].sort()).toEqual(t(0, 1, 2, 4).sort())
  })
})
