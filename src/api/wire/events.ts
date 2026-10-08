import { z } from 'zod'
import {
  WireBlocker,
  WireCard,
  WireEffect,
  WirePayout,
  WireScoring,
  WireTarget,
  WireTeamProgress,
} from './game'
import { Gem, Id, Item, Timestamp } from './primitives'

const event = <T extends string, S extends z.ZodRawShape>(type: T, shape: S) =>
  z.object({ type: z.literal(type), ...shape })

export const WireEvent = z.discriminatedUnion('type', [
  event('team_created', { team: Id, name: z.string() }),
  event('member_added', { team: Id, member: z.string() }),
  event('account_added', { team: Id, member: z.string(), rsn: z.string() }),
  event('game_started', { tiles: z.array(z.string()), gems: z.array(Id), positions: z.array(Id) }),
  event('game_ended', { winner: Id.nullable(), ranking: z.array(Id) }),
  event('card_drawn', { team: Id, card: WireCard, steps: z.int() }),
  event('paths_offered', { team: Id, length: z.int(), destinations: z.array(Id) }),
  event('move_confirmed', { team: Id, path: z.array(Id) }),
  event('stepped', { team: Id, tile: Id }),
  event('landed', { team: Id, tile: Id, instance: Id }),
  event('teleported', { team: Id, from: Id, to: Id }),
  event('trap_triggered', { team: Id, tile: Id, trap: WireBlocker, to: Id }),
  // `key` is empty (null or "") and `amount` 0 when only the effort changed.
  event('progress', {
    instance: Id,
    team: Id,
    key: z.string().nullable(),
    amount: z.number(),
    progress: WireTeamProgress,
  }),
  event('tile_completed', { team: Id, tile: Id }),
  event('gem_collected', { team: Id, gem: Gem, tile: Id }),
  event('gem_lost', { team: Id, gem: Gem }),
  event('gem_stolen', { from: Id, to: Id, gem: Gem }),
  event('necklace_used', { team: Id, gem: Gem }),
  event('shop_opened', { team: Id, tile: Id }),
  event('shop_closed', { team: Id }),
  // Inventories are private: the public journal blanks the item here, except for items lost in
  // plain sight (used, blocked a freeze, protected a gem).
  event('bought', { team: Id, item: Item.nullable(), price: z.number() }),
  event('item_gained', { team: Id, item: Item.nullable(), reason: z.string() }),
  event('item_lost', { team: Id, item: Item.nullable(), reason: z.string() }),
  event('item_used', { team: Id, item: Item, target: WireTarget.nullable() }),
  event('gold_changed', { team: Id, delta: z.number(), total: z.number(), reason: z.string() }),
  event('blocker_placed', { tile: Id, blocker: WireBlocker, by: Id }),
  event('blocker_removed', { tile: Id }),
  event('frozen', { team: Id, until: Timestamp }),
  event('shielded', { team: Id, until: Timestamp }),
  event('thawed', { team: Id }),
  event('random_event', {
    team: Id,
    id: z.string(),
    title: z.string(),
    text: z.string(),
    effect: WireEffect,
  }),
  event('joker_effect', { team: Id, effect: WireEffect }),
  event('minigame_opened', {
    id: Id,
    challenge: z.string(),
    scoring: WireScoring,
    initiator: Id,
    deadline: Timestamp,
  }),
  event('minigame_finished', { id: Id, team: Id, place: z.int().positive() }),
  event('minigame_closed', { id: Id, gold: z.array(WirePayout) }),
  event('opponent_choice', { team: Id, candidates: z.array(Id) }),
  event('match_started', {
    id: Id,
    mover: Id,
    defender: Id,
    challenge: z.string(),
    deadline: Timestamp,
  }),
  event('match_won', { id: Id, winner: Id, loser: Id, options: z.array(Gem) }),
  event('match_abandoned', { id: Id, mover: Id, defender: Id }),
])
export type WireEvent = z.infer<typeof WireEvent>

/** One journal entry: `GET /events` items and the stream's `entry` messages. */
export const WirePublished = z.object({
  seq: z.int().positive(),
  at: Timestamp,
  events: z.array(WireEvent),
})
export type WirePublished = z.infer<typeof WirePublished>
