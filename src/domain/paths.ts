// Walks along the board's roads, by the server's rule (`src/board/paths.rs` in the backend):
// every step goes to a neighbouring tile, never straight back to the tile just left. Whether a walk
// can go on depends only on the current tile and the one before it, so the searches memoise on
// that pair plus the steps left.
//
// Blockers never make a path invalid, but a team that walks onto one stops there and loses the
// rest of its move. So a route the player builds ends on the first blocker it enters, and the
// steps it never walks are filled in with any valid tail when it is sent.
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

/** Tiles with a blocker on them that has not worn off by `now`. */
export function blockerTiles(state: GameState, now: Date): Set<TileId> {
  const tiles = new Set<TileId>()
  for (const [tile, blocker] of state.blockers) if (blocker.until > now) tiles.add(tile)
  return tiles
}

const NONE = -1

export type WalkOptions = {
  near: ReadonlySet<TileId>
  far: ReadonlySet<TileId>
  ends: ReadonlySet<TileId>
  /** Further tiles a click reaches by first retracing part of the route; not marked on the map. */
  reroute: ReadonlySet<TileId>
}

type WalkState = { at: TileId; prev: TileId | typeof NONE; from: WalkState | null }

/**
 * Searches over walks of an exact length from one tile. `length` counts steps, so a path has
 * `length + 1` tiles, start included, which is what `confirm_path` expects. `stops` are blocker
 * tiles: a route ends on the first one it enters (the start tile does not count).
 */
export class Walks {
  private readonly canWalkMemo = new Map<string, boolean>()

  constructor(
    private readonly adj: Adjacency,
    private readonly stops: ReadonlySet<TileId>,
    readonly start: TileId,
    readonly length: number,
  ) {}

  private next(at: TileId, prev: TileId | typeof NONE): TileId[] {
    return (this.adj.get(at) ?? []).filter((n) => n !== prev)
  }

  /** Whether the route has walked onto a blocker, which ends the move there. */
  stopped(path: readonly TileId[]): boolean {
    const end = path.at(-1)
    return path.length >= 2 && end !== undefined && this.stops.has(end)
  }

  /** Steps the road rule still asks for after `path`, even if a blocker cuts the walk short. */
  private remaining(path: readonly TileId[]): number {
    return this.length - (path.length - 1)
  }

  /** Whether `path` can be completed to a full-length walk the server accepts. */
  private completable(path: readonly TileId[]): boolean {
    const end = path.at(-1) ?? this.start
    const before = path.length >= 2 ? (path.at(-2) ?? NONE) : NONE
    const left = this.remaining(path)
    return left >= 0 && this.canWalk(end, before, left)
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

  /**
   * Every tile some walk passes through, start excluded, and every tile a walk can end on, by the
   * road rule alone (blockers left out).
   */
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

  /**
   * Where a walk already started along `path` can go next. `near` is one step away, `far` are
   * further tiles a checkpoint can jump to (the stretch in between is filled in), `ends` are tiles
   * the whole walk can finish on, blockers included. Only tiles that leave the rest of the walk
   * possible count, so a player picking checkpoints can never get stuck.
   */
  options(path: readonly TileId[]): WalkOptions {
    const near = new Set<TileId>()
    const far = new Set<TileId>()
    const ends = new Set<TileId>()
    const levels = this.levels(path)
    const last = levels.length - 1
    const full = last === this.stepsLeft(path)
    levels.forEach((level, d) => {
      if (d === 0) return
      for (const s of level.values()) {
        if (!near.has(s.at)) (d === 1 ? near : far).add(s.at)
        if (this.stops.has(s.at) || (full && d === last)) ends.add(s.at)
      }
    })
    for (const tile of near) far.delete(tile)
    const reroute = this.rerouteTargets(path)
    for (const tile of [...near, ...far]) reroute.delete(tile)
    return { near, far, ends, reroute }
  }

  /** Steps still to walk after `path`: none once it has walked onto a blocker. */
  stepsLeft(path: readonly TileId[]): number {
    return this.stopped(path) ? 0 : this.remaining(path)
  }

  /**
   * The walk to send for a finished route: the route itself, or, when it ended on a blocker, the
   * route plus any valid tail for the steps the team will never walk. Null if it isn't finished.
   */
  complete(path: readonly TileId[]): TileId[] | null {
    if (this.stepsLeft(path) !== 0 || !this.completable(path)) return null
    const out = [...path]
    let prev: TileId | typeof NONE = out.length >= 2 ? (out.at(-2) ?? NONE) : NONE
    for (let left = this.remaining(out); left > 0; left--) {
      const at = out.at(-1) ?? this.start
      const step = this.next(at, prev).find((n) => this.canWalk(n, at, left - 1))
      if (step === undefined) return null
      out.push(step)
      prev = at
    }
    return out
  }

  /**
   * The shortest stretch from the end of `path` to `target` after which the walk can still be
   * finished, tiles after the current end only; null if `target` can't be the next checkpoint.
   */
  extend(path: readonly TileId[], target: TileId): TileId[] | null {
    const levels = this.levels(path)
    for (let d = 1; d < levels.length; d++) {
      const hit = [...(levels[d]?.values() ?? [])].find((s) => s.at === target)
      if (!hit) continue
      const out: TileId[] = []
      for (let s: WalkState | null = hit, k = d; s && k > 0; s = s.from, k--) out.unshift(s.at)
      return out
    }
    return null
  }

  /**
   * The route after a click on `target`: retracing first, then the shortest stretch on, then
   * cutting the route back to `target` if it is on it. Null if the click can't be used.
   */
  walkTo(path: readonly TileId[], target: TileId): TileId[] | null {
    const retraced = target === path.at(-1) ? null : this.retrace(path, target, this.tree(path))
    if (retraced) return retraced
    const stretch = this.extend(path, target)
    if (stretch) return [...path, ...stretch]
    const at = path.lastIndexOf(target)
    return at >= 0 ? path.slice(0, at + 1) : null
  }

  /** Tiles off the route a click can reach by retracing, some steps back and then on from there. */
  rerouteTargets(path: readonly TileId[]): Set<TileId> {
    const tree = this.tree(path)
    const onRoute = new Set(path)
    const out = new Set<TileId>()
    for (const tile of tree.keys()) {
      if (!onRoute.has(tile) && this.retrace(path, tile, tree)) out.add(tile)
    }
    return out
  }

  /**
   * The route after walking the shortest way from its end to `target`, where a step back onto the
   * tile before the end takes that step off the route: retracing your steps undoes them. Turning
   * straight back is never a move under the server's rule, so it is free to mean undo. Null if the
   * route that comes out can't be finished, or `target` is out of reach.
   */
  private retrace(
    path: readonly TileId[],
    target: TileId,
    tree: ReadonlyMap<TileId, TileId | typeof NONE>,
  ): TileId[] | null {
    if (!tree.has(target)) return null
    const segment: TileId[] = []
    for (let at: TileId | typeof NONE = target; at !== NONE; at = tree.get(at) ?? NONE) {
      segment.unshift(at)
    }
    const out = [...path]
    for (const tile of segment.slice(1)) {
      if (out.length >= 2 && tile === out.at(-2)) out.pop()
      else out.push(tile)
    }
    // The walk would stop on any blocker before the end.
    if (out.slice(1, -1).some((tile) => this.stops.has(tile))) return null
    return this.completable(out) ? out : null
  }

  /**
   * Shortest ways from the end of `path`, turning back allowed, as each tile's parent. They end on
   * blockers rather than pass them. No useful segment is longer than undoing the whole route and
   * walking all of it again.
   */
  private tree(path: readonly TileId[]): Map<TileId, TileId | typeof NONE> {
    const from = path.at(-1) ?? this.start
    const parent = new Map<TileId, TileId | typeof NONE>([[from, NONE]])
    const depth = new Map<TileId, number>([[from, 0]])
    const queue = [from]
    for (const at of queue) {
      const d = (depth.get(at) ?? 0) + 1
      if (d > path.length - 1 + this.length) continue
      if (at !== from && this.stops.has(at)) continue
      for (const n of this.adj.get(at) ?? []) {
        if (parent.has(n)) continue
        parent.set(n, at)
        depth.set(n, d)
        queue.push(n)
      }
    }
    return parent
  }

  /**
   * Breadth-first over (tile, previous tile) from the end of `path`: level d holds the states d
   * steps on from which the remaining steps can still be walked. A state on a blocker is kept but
   * goes no further, since the walk stops there.
   */
  private levels(path: readonly TileId[]): Map<string, WalkState>[] {
    const end = path.at(-1) ?? this.start
    const before = path.length >= 2 ? (path.at(-2) ?? NONE) : NONE
    if (!this.completable(path)) return []
    const left = this.stepsLeft(path)
    let level = new Map<string, WalkState>([
      [`${end},${before}`, { at: end, prev: before, from: null }],
    ])
    const levels = [level]
    for (let d = 1; d <= left; d++) {
      const next = new Map<string, WalkState>()
      for (const s of level.values()) {
        if (d > 1 && this.stops.has(s.at)) continue
        for (const n of this.next(s.at, s.prev)) {
          const key = `${n},${s.at}`
          if (next.has(key) || !this.canWalk(n, s.at, left - d)) continue
          next.set(key, { at: n, prev: s.at, from: s })
        }
      }
      levels.push(next)
      level = next
    }
    return levels
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

/** How many tiles two routes share from the start. */
export function sharedLength(a: readonly TileId[], b: readonly TileId[]): number {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
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
