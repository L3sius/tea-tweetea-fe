import type { Observation } from './activity'
import type { Appearance, Card } from './game'
import type { InstanceId, TeamId, TileId } from './ids'
import type { Item } from './vocabulary'

/** What an item is used on, for items that affect a rival team or a tile. */
export type ItemTarget = { kind: 'team'; teamId: TeamId } | { kind: 'tile'; tileId: TileId }

export type TeamCommand =
  | { kind: 'draw' }
  | { kind: 'use_item'; item: Item; target?: ItemTarget }
  /** The whole walk, start tile included. */
  | { kind: 'confirm_path'; path: TileId[] }
  | { kind: 'buy'; item: Item }
  /** A random item, straight into the inventory; every shop sells it. */
  | { kind: 'buy_mystery_box' }
  | { kind: 'close_shop' }
  | { kind: 'discard'; item: Item }
  /** Dress the team's own piece as an OSRS character, or back to the default piece with null. */
  | { kind: 'set_appearance'; appearance: Appearance | null }

export type AdminCommand =
  /** The server makes the team's code and replies with it, once. */
  | { kind: 'create_team'; name: string }
  /** Only before the game starts; the teams after it move down one id. */
  | { kind: 'delete_team'; teamId: TeamId }
  | { kind: 'rename_team'; teamId: TeamId; name: string }
  /** A new random code; the old one stops working at once. */
  | { kind: 'reset_team_code'; teamId: TeamId }
  /** Take a team out of the running game, or back in. */
  | { kind: 'set_withdrawn'; teamId: TeamId; withdrawn: boolean }
  | { kind: 'add_member'; teamId: TeamId; name: string }
  | { kind: 'rename_member'; teamId: TeamId; member: string; name: string }
  /** Removes the member and all their accounts. */
  | { kind: 'remove_member'; teamId: TeamId; member: string }
  | { kind: 'add_account'; teamId: TeamId; member: string; rsn: string }
  | { kind: 'remove_account'; teamId: TeamId; member: string; rsn: string }
  /** Dress the team's piece as an OSRS character, or back to the default piece with null. */
  | { kind: 'set_appearance'; teamId: TeamId; appearance: Appearance | null }
  | { kind: 'start_game' }
  | { kind: 'complete_tile'; teamId: TeamId; member: string }
  | { kind: 'contribute'; teamId: TeamId; instanceId: InstanceId; key: string; amount: number }
  | { kind: 'adjust_gold'; teamId: TeamId; delta: number }
  | { kind: 'discard_item'; teamId: TeamId; item: Item }
  /** Lost if the inventory is full. */
  | { kind: 'give_item'; teamId: TeamId; item: Item }
  /** Inject an observation as if Dink had sent it. */
  | { kind: 'observe'; rsn: string; observation: Observation }
  /** Remove a journal entry and replay the rest. */
  | { kind: 'revert'; seq: number }
  // Play-testing shortcuts; the server refuses them unless it runs with DEV_TOOLS=1.
  | { kind: 'dev_give_item'; teamId: TeamId; item: Item }
  /** Draw this card instead of the top of the deck; the team must be ready to draw. */
  | { kind: 'dev_draw_card'; teamId: TeamId; card: Card }
  /** Move the team to a tile and start its task, as a teleport does. */
  | { kind: 'dev_teleport'; teamId: TeamId; tileId: TileId }
  | { kind: 'dev_freeze'; teamId: TeamId; hours: number }
  | { kind: 'dev_thaw'; teamId: TeamId }

/** The journal entry a command produced; 0 if it changed nothing. */
export type CommandAccepted = { kind: 'accepted'; seq: number }

/** Journal entries a revert dropped. */
export type CommandReverted = { kind: 'reverted'; droppedSeqs: number[] }

/** A team's new code. The server keeps only its hash, so this is the one time anyone sees it. */
export type CodeIssued = { kind: 'issued'; seq: number; teamId: TeamId; code: string }

export type AdminReply = CommandAccepted | CommandReverted | CodeIssued
