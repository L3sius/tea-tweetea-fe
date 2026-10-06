import type { TeamId } from './ids'
import type { ClueTier } from './vocabulary'

export type Drop = { name: string; quantity: number; priceEach: number }

/** An in-game event reported by Dink, normalised by the server. */
export type Observation =
  | { kind: 'loot'; source: string; items: Drop[] }
  | { kind: 'clue'; tier: ClueTier; items: Drop[]; region: number | null }
  | { kind: 'kill_count'; boss: string; seconds: number | null }
  | { kind: 'slayer'; task: string }
  | { kind: 'pet'; name: string }
  | { kind: 'combat_achievement'; task: string }

export type ObservationKind = Observation['kind']

export type FeedItem = {
  id: number
  at: Date
  rsn: string
  teamId: TeamId | null
  kind: ObservationKind
  subject: string
  value: number
  /** Observations collapsed into this item (1 unless repeats were merged). */
  count: number
  observation: Observation
}

export type FeedQuery = {
  teamId?: TeamId
  rsn?: string
  kind?: ObservationKind
  /** Page back by passing the last id seen. */
  before?: number
  limit?: number
}

export type StatsGroup = 'account' | 'team' | 'subject' | 'hour'

export type StatsQuery = {
  by: StatsGroup
  kind?: ObservationKind
  teamId?: TeamId
  rsn?: string
  subject?: string
  limit?: number
}

export type StatRow = {
  key: string
  /** Observations in the group (kills for kill counts, caskets for clues). */
  count: number
  /** Total gp value (loot and clues). */
  value: number
}
