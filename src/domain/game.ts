import type { ChallengeId, InstanceId, MatchId, MinigameId, TeamId, TileId } from './ids'
import type { Gem, Item, Phase, Suit } from './vocabulary'

/** Ranks run 2–10, then J=11, Q=12, K=13, A=14. A Joker moves one tile. */
export type Card = { kind: 'joker' } | { kind: 'suited'; rank: number; suit: Suit }

/** Outcomes shared by Joker cards and random events. */
export type Effect =
  | { kind: 'lose_gem' }
  | { kind: 'teleport' }
  | { kind: 'halve_gold' }
  | { kind: 'gold'; amount: number }
  | { kind: 'freeze'; hours: number }
  | { kind: 'give_item'; item: Item }
  | { kind: 'lose_random_item' }
  | { kind: 'multiplier'; factor: number }
  | { kind: 'nothing' }

/** Effects pending on a team's next draw, move or shop visit. */
export type Effects = {
  /** Factor applied to the next move (1 = none). */
  moveMultiplier: number
  /** A rival's Harp of Rain halves the next move. */
  nextMoveHalved: boolean
  /** Draws of this suit pay gold, for this many more draws. */
  suitGold: { suit: Suit; drawsLeft: number } | null
  /** Only one item may be used per tile. */
  itemUsedHere: boolean
}

/** Decisions a moving team must take before walking on. */
export type Pause =
  | { kind: 'shop' }
  | { kind: 'choose_opponent'; candidates: TeamId[] }
  | { kind: 'match'; matchId: MatchId | null; opponent: TeamId }

export type Move = {
  /** The whole walk, start tile included. */
  path: TileId[]
  /** Index into `path` of the tile the team stands on. */
  atIndex: number
  /** Front first. */
  pauses: Pause[]
  /** Whether the tile at `atIndex` has been resolved. */
  currentTileResolved: boolean
}

export type TeamStatus =
  | { kind: 'idle' }
  | { kind: 'working'; instanceId: InstanceId }
  | { kind: 'ready' }
  | {
      kind: 'drawn'
      card: Card
      /** What the card is worth after effects. */
      steps: number
      /** The walk length, shorter than `steps` only when no walk that long exists. */
      length: number
      destinations: TileId[]
    }
  | { kind: 'moving'; move: Move }

export type Member = {
  name: string
  /** RuneScape names whose Dink reports count for the team, alts included. */
  accounts: string[]
}

export type Team = {
  id: TeamId
  name: string
  members: Member[]
  position: TileId
  status: TeamStatus
  /** Frozen and in-match sit on top of the status; the status resumes when they end. */
  frozenUntil: Date | null
  /** Hostile items can't target the team before then; every hit starts a new shield. */
  shieldUntil: Date | null
  matchId: MatchId | null
  gems: Set<Gem>
  gold: number
  items: Map<Item, number>
  cardsLeft: number
  effects: Effects
  tilesCompleted: number
  /** Quoted back on every action so two people acting at once cannot both succeed. */
  version: number
}

/**
 * Traps trigger once: a banana or a harpie bug swarm when walked over, a snake charmer when landed
 * on. A Wilderness web blocks its tile until it expires.
 */
export type Blocker =
  { kind: 'banana' } | { kind: 'swarm' } | { kind: 'snake' } | { kind: 'web'; until: Date }

export type InstanceScope =
  | { kind: 'tile'; teamId: TeamId; tileId: TileId }
  | { kind: 'minigame'; minigameId: MinigameId }
  | { kind: 'match'; matchId: MatchId }

/** One running copy of a challenge, for a tile, a minigame or a match. */
export type Instance = {
  id: InstanceId
  challengeId: ChallengeId
  startedAt: Date
  scope: InstanceScope
  /** Every team that can contribute: the tile's team, both match teams, or all teams. */
  progress: Map<TeamId, TeamProgress>
  /** Teams that have completed the challenge. */
  done: Set<TeamId>
}

/** One team's standing on an instance, as the server reports it; never recomputed here. */
export type TeamProgress = {
  /** Contributions per key (item, boss, pet, task …); goal `each` lists every key from the start. */
  counts: Map<string, number>
  /** Towards `target`; the task is complete when they are equal. */
  done: number
  target: number
  /** The challenge's effort: a count, or seconds for `best_time`; null until something counted. */
  effort: number | null
}

export type Scoring =
  { kind: 'contribution'; cap: number; goldPerUnit: number } | { kind: 'race'; payouts: number[] }

export type Payout = { teamId: TeamId; gold: number }

export type Minigame = {
  id: MinigameId
  instanceId: InstanceId
  scoring: Scoring
  /** The team that opened it by landing on a red tile; it earns double gold. */
  initiator: TeamId
  deadline: Date
  /** Finishing order (race scoring). */
  finished: TeamId[]
  /** Gold paid out, once the minigame has closed. */
  payouts: Payout[] | null
}

export type MatchOutcome =
  | { kind: 'open' }
  | { kind: 'stealing'; winner: TeamId; loser: TeamId; options: Gem[]; deadline: Date }
  | { kind: 'won'; winner: TeamId; stolen: Gem | null }
  | { kind: 'abandoned' }

export type Match = {
  id: MatchId
  instanceId: InstanceId
  mover: TeamId
  defender: TeamId
  deadline: Date
  outcome: MatchOutcome
}

/** Everything public about a game at one point in its journal. */
export type GameState = {
  seq: number
  serverTime: Date
  phase: Phase
  teams: Map<TeamId, Team>
  /** The challenge dealt to each tile. */
  tileChallenges: Map<TileId, ChallengeId>
  /** Where each gem currently sits. */
  gemTiles: Map<Gem, TileId>
  blockers: Map<TileId, Blocker>
  /** Active tile instances plus every minigame and match instance. */
  instances: Map<InstanceId, Instance>
  minigames: Map<MinigameId, Minigame>
  matches: Map<MatchId, Match>
}
