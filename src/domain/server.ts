import type { TeamId } from './ids'
import type { Item } from './vocabulary'

/** First message on the live stream. */
export type Hello = {
  serverTime: Date
  /** Changes on every deploy; a mismatch means the page should reload. */
  build: string
  seq: number
}

/** A Dink account's activity, registered or not. */
export type DinkAccount = {
  rsn: string
  /** Null for an account on no roster: a typo, a name change or someone not signed up. */
  teamId: TeamId | null
  lastSeen: Date
  posts: number
}

/** What only admins see: inventories, code status and which accounts Dink hears from. */
export type Overview = {
  seq: number
  teams: Map<TeamId, { items: Map<Item, number>; codeIssued: boolean }>
  /** Newest first. */
  accounts: DinkAccount[]
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
