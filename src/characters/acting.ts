// What a team's character is doing at any moment: which animation, and from when. Every random
// choice is seeded by the team and the journal (or the clock), so everyone watching sees the same
// thing, and a reloaded page picks up where it was.
import type { TeamId, TileId } from '@/domain/ids'
import { STEP_MS, type Placement, type Reaction } from '@/domain/motion'
import type { StuckCause } from '@/domain/stuck'
import { RANDOM, ROSTER, RUN_FROM_STEPS, optionIds, type Appearance, type Disguise } from './roster'

/**
 * An animation to play: frame 0 shows at `since` (ms), and it plays `rate` times as fast.
 * `sideways`: the character lies on the ground, so it turns across the screen to read as lying.
 * `stopAt`: it plays up to this client tick and stays there, a pose held partway through.
 * `disguise`: the piece shows this instead of its character, and `anim` animates it.
 */
export type Performance = {
  anim: number
  since: number
  rate: number
  sideways?: boolean
  stopAt?: number
  disguise?: Disguise
}

export type Situation = {
  team: TeamId
  /** Server time (ms). */
  time: number
  placement: Placement
  appearance: Appearance
  /** What holds the team in place and the server time it lets go, or null when it is free. */
  stuck: { until: number; cause: StuckCause } | null
  /** The team's reactions so far, latest first. */
  reactions: readonly Reaction[]
  isSea: (tile: TileId) => boolean
  /** Whether another team stands on the tile. */
  isOccupied: (tile: TileId) => boolean
  /** One loop of an animation, in ms; null until known. */
  lengthOf: (anim: number) => number | null
}

const TICK_MS = 20
/** Assumed for an animation whose length hasn't loaded yet. */
const UNKNOWN_LENGTH_MS = 2_000
/** Reactions and eggs stop after this long, whatever their animation. */
const MAX_PLAY_MS = 8_000
const MINUTE_MS = 60_000

export function perform(s: Situation): Performance {
  const loop = (anim: number): Performance => ({ anim, since: 0, rate: 1 })
  const p = s.placement
  if (p.kind === 'walk') return walking(s, p)
  if (p.kind === 'teleport') return loop(s.appearance.idle)
  return (
    reacting(s) ?? (s.stuck !== null ? held(s, s.stuck) : (idleEgg(s) ?? loop(s.appearance.idle)))
  )
}

/** A piece on the move (walking, here). */
type Walk = Exclude<Placement, { kind: 'still' }>

function walking(s: Situation, p: Walk): Performance {
  // Climbing past a team takes two steps: onto its tile and off again.
  const stepStart = s.time - p.progress * STEP_MS
  const pass = pick(ROSTER.reactions.pass, s.team, p.seq, 'pass')
  if (pass !== null && (s.isOccupied(p.to) || s.isOccupied(p.from))) {
    const since = s.isOccupied(p.to) ? stepStart : stepStart - STEP_MS
    const length = s.lengthOf(pass) ?? UNKNOWN_LENGTH_MS
    return { anim: pass, since, rate: length / (2 * STEP_MS) }
  }
  return { anim: gait(s, p), since: 0, rate: 1 }
}

/**
 * The team's walk, run or swim, now and then swapped for someone else's style. A style left to
 * chance picks once per move, so a move keeps one gait from start to end.
 */
function gait(s: Situation, p: Walk): number {
  const style =
    s.isSea(p.from) || s.isSea(p.to) ? 'swim' : p.steps >= RUN_FROM_STEPS ? 'run' : 'walk'
  const own = s.appearance[style]
  if (own === RANDOM) return pick(optionIds(style), s.team, p.seq, 'random', style) ?? own
  if (style === 'swim' || chance(s.team, p.seq, 'gait') >= ROSTER.easterEggs.gaitChancePerWalk)
    return own
  const others = [...ROSTER.styles.walk, ...ROSTER.styles.run]
    .map((o) => o.id)
    .filter((id) => id !== own)
  return pick(others, s.team, p.seq, 'gait-egg') ?? own
}

/** The latest reaction still playing, if any. */
function reacting(s: Situation): Performance | null {
  for (const reaction of s.reactions) {
    const stuck = ROSTER.stuck[reaction.cause ?? 'other']
    const lying = reaction.kind === 'struck' || reaction.kind === 'freed'
    const pool =
      reaction.kind === 'struck'
        ? stuck.hit
        : reaction.kind === 'freed'
          ? stuck.free
          : ROSTER.reactions[reaction.kind]
    const anim = pick(pool, s.team, reaction.id)
    if (anim === null) continue
    if (s.time < reaction.at + playLength(s, anim))
      return {
        anim,
        since: reaction.at,
        rate: 1,
        ...(lying && stuck.sideways && { sideways: true }),
        // A hit that ends in the held pose stops there, so the hold carries on from it.
        ...(reaction.kind === 'struck' && stuck.holdAt !== undefined && { stopAt: stuck.holdAt }),
        // The hit is the change itself; getting free is the character again.
        ...(reaction.kind === 'struck' && stuck.becomes && { disguise: stuck.becomes }),
      }
    // Older reactions ended before this one.
    return null
  }
  return null
}

/** The pose its cause leaves the team in, the same until it is free. */
function held(s: Situation, stuck: NonNullable<Situation['stuck']>): Performance {
  const { hold, holdAt, sideways, becomes } = ROSTER.stuck[stuck.cause]
  const anim = pick(hold, s.team, stuck.until, 'stuck')
  // A disguise has no idle of the team's to fall back on: it stands at rest instead.
  if (becomes) return { anim: anim ?? -1, since: 0, rate: 1, disguise: becomes }
  // Played long ago (`since` 0), so a pose held partway shows only its `holdAt` tick.
  return {
    anim: anim ?? s.appearance.idle,
    since: 0,
    rate: 1,
    ...(sideways && { sideways }),
    ...(holdAt !== undefined && { stopAt: holdAt }),
  }
}

/** Now and then, an idle character does an emote somewhere in the minute. */
function idleEgg(s: Situation): Performance | null {
  const minute = Math.floor(s.time / MINUTE_MS)
  if (chance(s.team, minute, 'idle-egg') >= ROSTER.easterEggs.idleChancePerMinute) return null
  const anim = pick(ROSTER.easterEggs.idle, s.team, minute, 'idle-egg-anim')
  if (anim === null) return null
  const length = playLength(s, anim)
  const start = minute * MINUTE_MS + chance(s.team, minute, 'idle-egg-at') * (MINUTE_MS - length)
  return s.time >= start && s.time < start + length ? { anim, since: start, rate: 1 } : null
}

/** How long a one-off animation plays: one loop, at most MAX_PLAY_MS. */
function playLength(s: Situation, anim: number): number {
  return Math.min(s.lengthOf(anim) ?? UNKNOWN_LENGTH_MS, MAX_PLAY_MS)
}

/** One loop of `ticks` client ticks, in ms. */
export const ticksToMs = (ticks: number) => ticks * TICK_MS

/** A number in [0, 1) that depends only on `parts`. */
export function chance(...parts: (string | number)[]): number {
  // FNV-1a over the parts, then a final avalanche so nearby seeds spread out.
  let h = 0x811c9dc5
  for (const char of parts.join('|')) {
    h ^= char.charCodeAt(0)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 2 ** 32
}

/** One of `pool`, chosen by `parts`; null for an empty pool. */
export function pick<T>(pool: readonly T[], ...parts: (string | number)[]): T | null {
  return pool[Math.floor(chance(...parts) * pool.length)] ?? null
}
