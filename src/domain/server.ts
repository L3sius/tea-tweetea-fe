import type { TeamId } from './ids'

/** First message on the live stream. */
export type Hello = {
  serverTime: Date
  /** Changes on every deploy; a mismatch means the page should reload. */
  build: string
  seq: number
}

/** The team a team code belongs to. */
export type TeamIdentity = { teamId: TeamId; name: string }
