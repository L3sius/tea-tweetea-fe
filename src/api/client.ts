import type { FeedItem, FeedQuery, StatRow, StatsQuery } from '@/domain/activity'
import type { Board } from '@/domain/board'
import type { Challenge } from '@/domain/challenge'
import type { AdminCommand, AdminReply, CommandAccepted, TeamCommand } from '@/domain/commands'
import type { JournalEntry } from '@/domain/events'
import type { GameState } from '@/domain/game'
import type { ItemEntry } from '@/domain/items'
import type { ChallengeId } from '@/domain/ids'
import type { Hello, Me } from '@/domain/server'
import type { Item } from '@/domain/vocabulary'

/** `live` while connected; `reconnecting` while the browser retries; `offline` when it gave up. */
export type StreamConnection = 'live' | 'reconnecting' | 'offline'

export type StreamMessage =
  | { kind: 'connection'; connection: StreamConnection }
  | { kind: 'hello'; hello: Hello }
  | { kind: 'entry'; entry: JournalEntry }
  /** New Dink activity; refetch the feed. */
  | { kind: 'feed' }
  /** The stream lost its place; refetch the state and subscribe again from its seq. */
  | { kind: 'resync' }

export type StreamListener = (message: StreamMessage) => void

export type JournalPage = {
  /** Only entries after this sequence number. */
  after?: number
  /** At most 500. */
  limit?: number
}

export type TeamCommandRequest = {
  teamCode: string
  /** The team's version from the latest state. */
  version: number
  command: TeamCommand
  /** One per user intent, so a retried request is not applied twice. */
  idempotencyKey: string
}

export type AdminCommandRequest = { adminCode: string; command: AdminCommand }

/**
 * The game API in domain terms. Every method rejects with an `ApiError`.
 * Components never use this directly; stores do.
 */
export type ApiClient = {
  getBoard(): Promise<Board>
  getChallenges(): Promise<Map<ChallengeId, Challenge>>
  /** The item catalogue: names, descriptions and pictures. */
  getItems(): Promise<Map<Item, ItemEntry>>
  getState(): Promise<GameState>
  /** Journal entries, oldest first. */
  getJournal(page?: JournalPage): Promise<JournalEntry[]>
  /** Feed items, newest first. */
  getFeed(query?: FeedQuery): Promise<FeedItem[]>
  getStats(query: StatsQuery): Promise<StatRow[]>
  /** Checks a team code and returns its team, with the team's private inventory. */
  getMe(teamCode: string): Promise<Me>
  sendTeamCommand(request: TeamCommandRequest): Promise<CommandAccepted>
  sendAdminCommand(request: AdminCommandRequest): Promise<AdminReply>
  /** Live journal entries after `afterSeq`, in order. Returns a function that closes the stream. */
  subscribe(afterSeq: number, listener: StreamListener): () => void
}
