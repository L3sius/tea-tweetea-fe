import type { Appearance, Blocker, Card, Effect, Payout, Scoring, TeamProgress } from './game'
import type { ChallengeId, InstanceId, MinigameId, TeamId, TileId } from './ids'
import type { ItemTarget } from './commands'
import type { Gem, Item } from './vocabulary'

/** Something that happened in the game, in the order it happened within one command. */
export type GameEvent =
  // Setup and end
  | { kind: 'team_created'; teamId: TeamId; name: string }
  | { kind: 'member_added'; teamId: TeamId; member: string }
  | { kind: 'appearance_set'; teamId: TeamId; appearance: Appearance | null }
  | { kind: 'account_added'; teamId: TeamId; member: string; rsn: string }
  | { kind: 'game_started'; tileChallenges: ChallengeId[]; gemTiles: TileId[]; positions: TileId[] }
  | { kind: 'game_ended'; winner: TeamId | null; ranking: TeamId[] }
  // Movement
  | { kind: 'card_drawn'; teamId: TeamId; card: Card; steps: number }
  | { kind: 'paths_offered'; teamId: TeamId; length: number; destinations: TileId[] }
  | { kind: 'move_confirmed'; teamId: TeamId; path: TileId[] }
  | { kind: 'stepped'; teamId: TeamId; tileId: TileId }
  | { kind: 'landed'; teamId: TeamId; tileId: TileId; instanceId: InstanceId }
  | { kind: 'teleported'; teamId: TeamId; from: TileId; to: TileId }
  /** The team walked onto a blocker and stopped there; `landed` and `frozen` follow. */
  | { kind: 'blocker_triggered'; teamId: TeamId; tileId: TileId; blocker: Blocker }
  // Tasks
  | {
      kind: 'progress'
      instanceId: InstanceId
      teamId: TeamId
      /** What counted and how much; null with `amount` 0 when only the effort changed. */
      key: string | null
      amount: number
      /** The team's whole standing after it, to replace the old one. */
      progress: TeamProgress
    }
  | { kind: 'tile_completed'; teamId: TeamId; tileId: TileId }
  // Gems
  | { kind: 'gem_collected'; teamId: TeamId; gem: Gem; tileId: TileId }
  /** A Joker or a random event took the gem. */
  | { kind: 'gem_lost'; teamId: TeamId; gem: Gem }
  // Shops and items
  | { kind: 'shop_opened'; teamId: TeamId; tileId: TileId }
  | { kind: 'shop_closed'; teamId: TeamId }
  /** The item is null when it is private: the public journal names only items lost in plain sight. */
  | { kind: 'bought'; teamId: TeamId; item: Item | null; price: number; mysteryBox: boolean }
  | { kind: 'item_gained'; teamId: TeamId; item: Item | null; reason: string }
  | { kind: 'item_lost'; teamId: TeamId; item: Item | null; reason: string }
  | { kind: 'item_used'; teamId: TeamId; item: Item; target: ItemTarget | null }
  | { kind: 'gold_changed'; teamId: TeamId; delta: number; total: number; reason: string }
  // Board effects
  | { kind: 'blocker_placed'; tileId: TileId; blocker: Blocker; by: TeamId }
  | { kind: 'blocker_removed'; tileId: TileId }
  | { kind: 'frozen'; teamId: TeamId; until: Date }
  | { kind: 'shielded'; teamId: TeamId; until: Date }
  | { kind: 'thawed'; teamId: TeamId }
  | {
      kind: 'random_event'
      teamId: TeamId
      id: string
      title: string
      text: string
      effect: Effect
    }
  | { kind: 'joker_effect'; teamId: TeamId; effect: Effect }
  // Minigames
  | {
      kind: 'minigame_opened'
      minigameId: MinigameId
      challengeId: ChallengeId
      scoring: Scoring
      initiator: TeamId
      deadline: Date
    }
  | { kind: 'minigame_finished'; minigameId: MinigameId; teamId: TeamId; place: number }
  | { kind: 'minigame_closed'; minigameId: MinigameId; payouts: Payout[] }

export type GameEventKind = GameEvent['kind']

/** The events of one accepted command, as stored in the server's journal. */
export type JournalEntry = { seq: number; at: Date; events: GameEvent[] }
