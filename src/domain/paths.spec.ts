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
function isValid(path: TileId[], length: number) {
  if (path.length !== length + 1) return false
  for (const [i, tile] of path.entries()) {
    if (i === 0) continue
    if (!adj.get(path[i - 1] ?? tile)?.includes(tile)) return false
    if (i >= 2 && tile === path[i - 2]) return false
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
})

describe('Walks with blockers', () => {
  it('ends the route on the first blocker it enters', () => {
    const walks = new Walks(adj, new Set(t(2)), tileId(0), 4)
    const route = t(0, 1, 2)
    expect(walks.stopped(route)).toBe(true)
    expect(walks.stepsLeft(route)).toBe(0)
    const { near, far } = walks.options(route)
    expect(near.size + far.size).toBe(0)
  })

  it('fills in the steps a blocker cuts off so the server gets a full walk', () => {
    const walks = new Walks(adj, new Set(t(2)), tileId(0), 4)
    const full = walks.complete(t(0, 1, 2))
    expect(full?.slice(0, 3)).toEqual(t(0, 1, 2))
    expect(isValid(full ?? [], 4)).toBe(true)
    expect(walks.complete(t(0, 1))).toBeNull()
  })

  it('offers a blocker as a place to end, but nothing past it', () => {
    const { near, far, ends } = new Walks(adj, new Set(t(1)), tileId(0), 3).options(t(0))
    expect([...near]).toEqual(t(1))
    expect(far.size).toBe(0)
    expect([...ends]).toEqual(t(1))
  })

  it('lets a team standing on a blocker walk off it', () => {
    const walks = new Walks(adj, new Set(t(0)), tileId(0), 3)
    expect(walks.stopped(t(0))).toBe(false)
    expect([...walks.options(t(0)).near]).toEqual(t(1))
  })

  it('goes round a blocker to reach a tile behind it', () => {
    const walks = new Walks(adj, new Set(t(4)), tileId(0), 5)
    expect(walks.walkTo(t(0, 1, 2), tileId(5))).toEqual(t(0, 1, 2, 3, 6, 5))
  })

  it('walks onto a blocker and back off it to undo', () => {
    const walks = new Walks(adj, new Set(t(4)), tileId(0), 5)
    const route = walks.walkTo(t(0, 1), tileId(4))
    expect(route).toEqual(t(0, 1, 4))
    expect(walks.walkTo(route ?? [], tileId(1))).toEqual(t(0, 1))
  })
})

describe('Walks checkpoints', () => {
  it('offers the next step, further checkpoints and where the walk can end', () => {
    const { near, far, ends } = new Walks(adj, none, tileId(0), 3).options(t(0))
    expect([...near]).toEqual(t(1))
    expect([...far].sort()).toEqual(t(2, 3, 4, 5, 7).sort())
    expect([...ends].sort()).toEqual(t(3, 5, 7).sort())
  })

  it('never offers turning straight back', () => {
    const { near } = new Walks(adj, none, tileId(0), 4).options(t(0, 1, 2))
    expect(near.has(tileId(1))).toBe(false)
  })

  it('leaves out tiles that would strand the walk', () => {
    // Two steps left at 2: the dead end 7 has nowhere to go for the last step.
    const { near, far } = new Walks(adj, none, tileId(0), 4).options(t(0, 1, 2))
    expect([...near]).toEqual(t(3))
    expect(far.has(tileId(7))).toBe(false)
  })

  it('fills in the shortest stretch to a far checkpoint', () => {
    const walks = new Walks(adj, none, tileId(0), 3)
    expect(walks.extend(t(0), tileId(5))).toEqual(t(1, 4, 5))
    expect(walks.extend(t(0), tileId(6))).toBeNull()
  })

  it('allows going round a loop back onto a visited tile', () => {
    const walks = new Walks(adj, none, tileId(0), 7)
    const path = t(0, 1, 2, 3, 6, 5, 4)
    expect(walks.extend(path, tileId(1))).toEqual(t(1))
    const full = [...path, tileId(1)]
    expect(walks.stepsLeft(full)).toBe(0)
    expect(isValid(full, 7)).toBe(true)
  })

  it('offers nothing once a walk cannot be finished', () => {
    // At the dead end 7 with steps left: no way on.
    const { near, far } = new Walks(adj, none, tileId(0), 5).options(t(0, 1, 2, 7))
    expect(near.size + far.size).toBe(0)
  })
})

describe('Walks.walkTo', () => {
  it('extends forward like a checkpoint', () => {
    const walks = new Walks(adj, none, tileId(0), 4)
    expect(walks.walkTo(t(0), tileId(2))).toEqual(t(0, 1, 2))
  })

  it('undoes steps when walking back along the route', () => {
    const walks = new Walks(adj, none, tileId(0), 4)
    expect(walks.walkTo(t(0, 1, 2, 3), tileId(1))).toEqual(t(0, 1))
    expect(walks.walkTo(t(0, 1, 2, 3), tileId(0))).toEqual(t(0))
  })

  it('backs up and branches off when that is the shortest way', () => {
    // From 0-1-2, 4 is two clicks away by undoing 2; going on round the loop would be too long.
    const walks = new Walks(adj, none, tileId(0), 4)
    expect(walks.walkTo(t(0, 1, 2), tileId(4))).toEqual(t(0, 1, 4))
    expect(walks.options(t(0, 1, 2)).reroute.has(tileId(4))).toBe(true)
  })

  it('never leaves a route that cannot be finished', () => {
    // 0-1-2-7 is a dead end with steps left over, so it is not offered even though it is close.
    const walks = new Walks(adj, none, tileId(0), 5)
    expect(walks.walkTo(t(0, 1, 2, 3), tileId(7))).toBeNull()
    expect(walks.options(t(0, 1, 2, 3)).reroute.has(tileId(7))).toBe(false)
  })

  it('goes round a loop onto a route tile when that is shorter than walking back', () => {
    const walks = new Walks(adj, none, tileId(0), 7)
    const path = walks.walkTo(t(0, 1, 4, 5, 6, 3), tileId(1))
    expect(path).toEqual(t(0, 1, 4, 5, 6, 3, 2, 1))
    expect(isValid(path ?? [], 7)).toBe(true)
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
