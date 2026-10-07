import { z } from 'zod'
import { toFeedItem, toStatRow } from './mappers/activity'
import { toBoard } from './mappers/board'
import { toChallenges } from './mappers/challenge'
import { toJournalEntry } from './mappers/events'
import { toGameState } from './mappers/game'
import { toItemCatalogue } from './mappers/items'
import { toAccepted, toAdminReply, toTeamIdentity } from './mappers/server'
import { WireFeedItem, WireStatRow } from './wire/activity'
import { WireBoard } from './wire/board'
import { WireChallenges } from './wire/challenge'
import { WirePublished } from './wire/events'
import { WireState } from './wire/game'
import { WireItems } from './wire/items'
import { WireAccepted, WireAdminReply, WireMe } from './wire/server'

type Endpoint<S extends z.ZodType, D> = { path: string; schema: S; map: (wire: z.output<S>) => D }

const endpoint = <S extends z.ZodType, D>(
  path: string,
  schema: S,
  map: (wire: z.output<S>) => D,
): Endpoint<S, D> => ({ path, schema, map })

/** Each endpoint's response schema and its mapping into the domain, shared by every client. */
export const endpoints = {
  board: endpoint('/board', WireBoard, toBoard),
  challenges: endpoint('/challenges', WireChallenges, toChallenges),
  items: endpoint('/items', WireItems, toItemCatalogue),
  state: endpoint('/state', WireState, toGameState),
  journal: endpoint('/events', z.array(WirePublished), (entries) => entries.map(toJournalEntry)),
  feed: endpoint('/feed', z.array(WireFeedItem), (items) => items.map(toFeedItem)),
  stats: endpoint('/stats', z.array(WireStatRow), (rows) => rows.map(toStatRow)),
  me: endpoint('/team/me', WireMe, toTeamIdentity),
  teamAction: endpoint('/team/action', WireAccepted, toAccepted),
  adminAction: endpoint('/admin/action', WireAdminReply, toAdminReply),
}
