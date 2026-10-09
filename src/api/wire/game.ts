import { z } from 'zod'
import { GEMS } from '@/domain/vocabulary'
import { Gem, Id, Item, Phase, Suit, Timestamp, idKeyed } from './primitives'

/** A Joker has rank 0 and no suit; every other card has a rank of 2–14 and a suit. */
export const WireCard = z.union([
  z.object({ rank: z.literal(0), suit: z.null() }),
  z.object({ rank: z.int().min(2).max(14), suit: Suit }),
])
export type WireCard = z.infer<typeof WireCard>

export const WireEffect = z.discriminatedUnion('effect', [
  z.object({ effect: z.literal('lose_gem') }),
  z.object({ effect: z.literal('teleport') }),
  z.object({ effect: z.literal('halve_gold') }),
  z.object({ effect: z.literal('gold'), amount: z.number() }),
  z.object({ effect: z.literal('freeze'), hours: z.number() }),
  // Item names are private: the public journal blanks which item was given.
  z.object({ effect: z.literal('give_item'), item: Item.nullable() }),
  z.object({ effect: z.literal('lose_random_item') }),
  z.object({ effect: z.literal('multiplier'), factor: z.number() }),
  z.object({ effect: z.literal('nothing') }),
])
export type WireEffect = z.infer<typeof WireEffect>

/** A blocker item on a tile: who placed it and when it leaves the board. */
export const WireBlocker = z.object({ item: Item, owner: Id, until: Timestamp })
export type WireBlocker = z.infer<typeof WireBlocker>

export const WireScoring = z.discriminatedUnion('type', [
  z.object({ type: z.literal('contribution'), cap: z.number(), gold_per_unit: z.number() }),
  z.object({ type: z.literal('race'), payouts: z.array(z.number()) }),
])
export type WireScoring = z.infer<typeof WireScoring>

export const WirePayout = z.object({ team: Id, gold: z.number() })
export type WirePayout = z.infer<typeof WirePayout>

export const WireTarget = z.discriminatedUnion('target', [
  z.object({ target: z.literal('team'), id: Id }),
  z.object({ target: z.literal('tile'), id: Id }),
])
export type WireTarget = z.infer<typeof WireTarget>

const Pause = z.discriminatedUnion('pause', [
  z.object({ pause: z.literal('shop') }),
  z.object({ pause: z.literal('choose_opponent'), candidates: z.array(Id) }),
  z.object({ pause: z.literal('match'), id: Id.nullable(), opponent: Id }),
])

// The server flattens the move into the `moving` status.
const Status = z.discriminatedUnion('status', [
  z.object({ status: z.literal('idle') }),
  z.object({ status: z.literal('working'), instance: Id }),
  z.object({ status: z.literal('ready') }),
  z.object({
    status: z.literal('drawn'),
    card: WireCard,
    steps: z.int(),
    length: z.int(),
    destinations: z.array(Id),
  }),
  z.object({
    status: z.literal('moving'),
    path: z.array(Id).min(1),
    at: z.int().nonnegative(),
    pauses: z.array(Pause),
    checked: z.boolean(),
  }),
])
export type WireStatus = z.infer<typeof Status>

export const WireAppearance = z.object({
  npc: z.int(),
  idle: z.int(),
  walk: z.int(),
  run: z.int(),
  swim: z.int(),
})
export type WireAppearance = z.infer<typeof WireAppearance>

export const WireTeam = z.object({
  id: Id,
  name: z.string(),
  members: z.array(z.object({ name: z.string(), accounts: z.array(z.string()) })),
  position: Id,
  status: Status,
  frozen_until: Timestamp.nullable(),
  shield_until: Timestamp.nullable(),
  match_id: Id.nullable(),
  gems: z.array(Gem),
  gold: z.number(),
  effects: z.object({
    multiplier: z.number(),
    halved: z.boolean(),
    suit_gold: z.tuple([Suit, z.int()]).nullable(),
    item_used_here: z.boolean(),
  }),
  tiles_completed: z.int(),
  version: z.int(),
  appearance: WireAppearance.nullable(),
})
export type WireTeam = z.infer<typeof WireTeam>

const Scope = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('tile'), team: Id, tile: Id }),
  z.object({ scope: z.literal('minigame'), id: Id }),
  z.object({ scope: z.literal('match'), id: Id }),
])

/** One team's standing on an instance, sent whole in every `progress` event. */
export const WireTeamProgress = z.object({
  counts: z.record(z.string(), z.number()),
  done: z.number(),
  target: z.number(),
  effort: z.number().nullable(),
})
export type WireTeamProgress = z.infer<typeof WireTeamProgress>

export const WireInstance = z.object({
  challenge: z.string(),
  started: Timestamp,
  scope: Scope,
  progress: idKeyed(WireTeamProgress),
  done: z.array(Id),
})
export type WireInstance = z.infer<typeof WireInstance>

export const WireMinigame = z.object({
  id: Id,
  instance: Id,
  scoring: WireScoring,
  initiator: Id,
  deadline: Timestamp,
  finished: z.array(Id),
  gold: z.array(WirePayout).nullable(),
})
export type WireMinigame = z.infer<typeof WireMinigame>

const MatchOutcome = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('open') }),
  z.object({
    outcome: z.literal('stealing'),
    winner: Id,
    loser: Id,
    options: z.array(Gem),
    deadline: Timestamp,
  }),
  z.object({ outcome: z.literal('won'), winner: Id, stolen: Gem.nullable() }),
  z.object({ outcome: z.literal('abandoned') }),
])

export const WireMatch = z.object({
  id: Id,
  instance: Id,
  mover: Id,
  defender: Id,
  deadline: Timestamp,
  outcome: MatchOutcome,
})
export type WireMatch = z.infer<typeof WireMatch>

/** `GET /state`. */
export const WireState = z.object({
  seq: z.int().nonnegative(),
  server_time: Timestamp,
  phase: Phase,
  teams: z.array(WireTeam),
  /** Challenge id per tile, indexed by tile id. */
  tiles: z.array(z.string()),
  /** Gem tile per gem, indexed in gem order. */
  gems: z.array(Id).length(GEMS.length),
  blockers: idKeyed(WireBlocker),
  /** Each shop tile's stock; every shop also sells the mystery box. */
  shops: idKeyed(z.array(Item)),
  instances: idKeyed(WireInstance),
  minigames: idKeyed(WireMinigame),
  matches: idKeyed(WireMatch),
})
export type WireState = z.infer<typeof WireState>
