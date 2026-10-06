// Walks along the board's roads, by the server's rule (`src/board/paths.rs` in the backend):
// every step goes to a neighbouring tile, never straight back to the tile just left and never onto
// a rock. Whether a walk can go on depends only on the current tile and the one before it, so the
// searches memoise on that pair plus the steps left.
import type { Board, Road } from './board'
import type { GameState } from './game'
import type { TileId } from './ids'

export type Adjacency = ReadonlyMap<TileId, readonly TileId[]>

export function adjacency(roads: readonly Road[]): Map<TileId, TileId[]> {
  const adj = new Map<TileId, TileId[]>()
  const link = (a: TileId, b: TileId) => {
    const list = adj.get(a)
    if (list) list.push(b)
    else adj.set(a, [b])
  }
  for (const [a, b] of roads) {
    link(a, b)
    link(b, a)
  }
  return adj
}

/** Tiles with a rock on them that has not worn off by `now`. */
export function rockTiles(state: GameState, now: Date): Set<TileId> {
  const rocks = new Set<TileId>()
  for (const [tile, blocker] of state.blockers) {
    if (blocker.kind === 'rock' && blocker.until > now) rocks.add(tile)
  }
  return rocks
}

const NONE = -1

/**
 * Searches over walks of an exact length from one tile. `length` counts steps, so a path has
 * `length + 1` tiles, start included, which is what `confirm_path` expects.
 */
export class Walks {
  private readonly canWalkMemo = new Map<string, boolean>()

  constructor(
    private readonly adj: Adjacency,
    private readonly rocks: ReadonlySet<TileId>,
    readonly start: TileId,
    readonly length: number,
  ) {}

  private next(at: TileId, prev: TileId | typeof NONE): TileId[] {
    return (this.adj.get(at) ?? []).filter((n) => n !== prev && !this.rocks.has(n))
  }

  /** Whether `k` more steps can be taken from `at`, having arrived from `prev`. */
  private canWalk(at: TileId, prev: TileId | typeof NONE, k: number): boolean {
    if (k === 0) return true
    const key = `${at},${prev},${k}`
    let known = this.canWalkMemo.get(key)
    if (known === undefined) {
      known = this.next(at, prev).some((n) => this.canWalk(n, at, k - 1))
      this.canWalkMemo.set(key, known)
    }
    return known
  }

  /** Every tile some walk passes through, start excluded, and every tile a walk can end on. */
  reach(): { onAnyWalk: Set<TileId>; ends: Set<TileId> } {
    const onAnyWalk = new Set<TileId>()
    const ends = new Set<TileId>()
    const seen = new Set<string>()
    const visit = (at: TileId, prev: TileId | typeof NONE, left: number) => {
      const key = `${at},${prev},${left}`
      if (seen.has(key)) return
      seen.add(key)
      if (left === 0) return void ends.add(at)
      for (const n of this.next(at, prev)) {
        if (!this.canWalk(n, at, left - 1)) continue
        onAnyWalk.add(n)
        visit(n, at, left - 1)
      }
    }
    visit(this.start, NONE, this.length)
    return { onAnyWalk, ends }
  }

  /** A walk that ends on `target`, or null. */
  endingAt(target: TileId): TileId[] | null {
    return this.find(target, true)
  }

  /** A walk that passes through `target` (or ends on it), or null. */
  through(target: TileId): TileId[] | null {
    return this.find(target, false)
  }

  /** Depth-first, only entering branches that can still meet the goal, so it never backtracks far. */
  private find(target: TileId, mustEnd: boolean): TileId[] | null {
    const memo = new Map<string, boolean>()
    // Whether, from `at` (arrived from `prev`) with `k` steps left, a walk can meet the goal.
    // `met` says the target has already been passed.
    const ok = (at: TileId, prev: TileId | typeof NONE, k: number, met: boolean): boolean => {
      if (k === 0) return mustEnd ? at === target : met || at === target
      if (!mustEnd && (met || at === target)) return this.canWalk(at, prev, k)
      const key = `${at},${prev},${k}`
      let known = memo.get(key)
      if (known === undefined) {
        known = this.next(at, prev).some((n) => ok(n, at, k - 1, false))
        memo.set(key, known)
      }
      return known
    }
    if (!ok(this.start, NONE, this.length, false)) return null
    const path = [this.start]
    let prev: TileId | typeof NONE = NONE
    let met = this.start === target && !mustEnd
    for (let left = this.length; left > 0; left--) {
      const at = path.at(-1) ?? this.start
      const step = this.next(at, prev).find((n) => ok(n, at, left - 1, met))
      if (step === undefined) return null
      path.push(step)
      prev = at
      met ||= step === target
    }
    return path
  }
}

/** The tile closest to a point, by squared distance in whatever space `position` returns. */
export function nearestTile(
  candidates: Iterable<TileId>,
  position: (tile: TileId) => { x: number; y: number } | null,
  point: { x: number; y: number },
): TileId | null {
  let best: TileId | null = null
  let bestDistance = Infinity
  for (const tile of candidates) {
    const at = position(tile)
    if (!at) continue
    const d = (at.x - point.x) ** 2 + (at.y - point.y) ** 2
    if (d < bestDistance) {
      bestDistance = d
      best = tile
    }
  }
  return best
}

/** Tiles at most `range` road steps from `from`, for items that target a nearby tile. */
export function tilesWithin(adj: Adjacency, from: TileId, range: number): Set<TileId> {
  const dist = new Map<TileId, number>([[from, 0]])
  const queue = [from]
  // Iterating an array while pushing to it visits the new items too: a queue.
  for (const at of queue) {
    const d = (dist.get(at) ?? 0) + 1
    if (d > range) continue
    for (const n of adj.get(at) ?? []) {
      if (dist.has(n)) continue
      dist.set(n, d)
      queue.push(n)
    }
  }
  return new Set(dist.keys())
}

export const boardAdjacency = (board: Board) => adjacency(board.roads)
