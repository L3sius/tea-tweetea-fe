// What a team's character is doing at any moment: which animation, and from when. Every random
// choice is seeded by the team and the journal (or the clock), so everyone watching sees the same
// thing, and a reloaded page picks up where it was.
import type { TeamId, TileId } from '@/domain/ids'
import { STEP_MS, type Placement, type Reaction } from '@/domain/motion'
import { ROSTER, RUN_FROM_STEPS, type Appearance } from './roster'

/** An animation to play: frame 0 shows at `since` (ms), and it plays `rate` times as fast. */
export type Performance = { anim: number; since: number; rate: number }

export type Situation = {
  team: TeamId
  /** Server time (ms). */
  time: number
  placement: Placement
  appearance: Appearance
  /** Server time a freeze ends, or null when not frozen. */
  frozenUntil: number | null
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
    reacting(s) ?? (s.frozenUntil !== null ? frozen(s) : (idleEgg(s) ?? loop(s.appearance.idle)))
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

/** The team's walk, run or swim, now and then swapped for someone else's style. */
function gait(s: Situation, p: Walk): number {
  const style =
    s.isSea(p.from) || s.isSea(p.to) ? 'swim' : p.steps >= RUN_FROM_STEPS ? 'run' : 'walk'
  const own = s.appearance[style]
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
    const anim = pick(ROSTER.reactions[reaction.kind], s.team, reaction.id)
    if (anim === null) continue
    if (s.time < reaction.at + playLength(s, anim)) return { anim, since: reaction.at, rate: 1 }
    // Older reactions ended before this one.
    return null
  }
  return null
}

/** A frozen pose, the same for the whole freeze. */
function frozen(s: Situation): Performance {
  const anim = pick(ROSTER.reactions.frozen, s.team, s.frozenUntil ?? 0, 'frozen')
  return { anim: anim ?? s.appearance.idle, since: 0, rate: 1 }
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
