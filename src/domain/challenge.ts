import type { ChallengeId } from './ids'
import type { CaTier, ClueTier } from './vocabulary'

/** Loot sources as Dink reports them, or every source. */
export type Sources = { kind: 'any' } | { kind: 'listed'; names: string[] }

export type ItemRequirement = {
  /** Item name exactly as the game reports it; also the progress key. */
  name: string
  aliases: string[]
  sources: Sources
}

export type LootFilter =
  | { kind: 'items'; items: ItemRequirement[] }
  | { kind: 'value'; minGp: number; per: 'stack' | 'drop'; sources: Sources }

export type ClueFilter =
  | { kind: 'count' }
  | { kind: 'value'; minGp: number; maxGp: number | null }
  | { kind: 'region'; regionIds: number[] }
  | { kind: 'items'; items: string[] }
  | { kind: 'exact_stack'; item: string; quantity: number }

/** Which Dink events count towards a challenge. */
export type Criterion =
  | { kind: 'loot'; filter: LootFilter }
  | { kind: 'clue'; tier: ClueTier; filter: ClueFilter }
  | { kind: 'kill_count'; bosses: string[] }
  | { kind: 'timed_kill'; boss: string; maxSeconds: number }
  | { kind: 'slayer'; tasks: string[] }
  | { kind: 'pet'; pets: string[] }
  | { kind: 'combat_achievement'; tasks: CaTask[] }

/** One combat achievement, with its in-game text. */
export type CaTask = {
  /** Name exactly as the game reports it; also the progress key. */
  name: string
  /** The in-game task text, e.g. "Kill an Aberrant Spectre." */
  description: string
  tier: CaTier
  /** The monster or activity the wiki files it under. */
  monster: string | null
}

/**
 * Effort spent on a task, shown next to its progress; it never decides completion. Each team's
 * `effort` counts kills, loots or caskets, the best time in seconds, or nothing for `elapsed`
 * (the time since the task started).
 */
export type Effort =
  | { kind: 'kills'; bosses: string[] }
  | { kind: 'loots'; sources: Sources }
  | { kind: 'caskets'; tier: ClueTier }
  | { kind: 'best_time'; boss: string }
  | { kind: 'elapsed' }

/** `total`: n contributions across all keys. `each`: n contributions under every key. */
export type Goal = { kind: 'total'; n: number } | { kind: 'each'; n: number }

export type Challenge = {
  id: ChallengeId
  name: string
  description: string
  /** Expected hours for one player to complete it. */
  estHours: number
  tags: string[]
  criterion: Criterion
  goal: Goal
  effort: Effort
}
