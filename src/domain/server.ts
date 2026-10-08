import type { TeamId } from './ids'
import type { Item } from './vocabulary'

/** First message on the live stream. */
export type Hello = {
  serverTime: Date
  /** Changes on every deploy; a mismatch means the page should reload. */
  build: string
  seq: number
}

/** The team a team code belongs to, with what only that team may see. */
export type Me = {
  teamId: TeamId
  name: string
  /** The team's inventory; other teams never see it. */
  items: Map<Item, number>
  /** The journal entry this is current to. */
  seq: number
}
