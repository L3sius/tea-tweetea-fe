import type { Gem, Item } from '@/domain/vocabulary'
import type { WireObservation } from './activity'
import type { WireCard, WireTarget } from './game'

// Request bodies are built by the client, never received, so they need types but no schemas.

type TeamAction =
  | { action: 'draw' }
  | { action: 'use_item'; item: Item; target?: WireTarget }
  | { action: 'confirm_path'; path: number[] }
  | { action: 'buy'; item: Item }
  | { action: 'close_shop' }
  | { action: 'choose_opponent'; opponent: number }
  | { action: 'steal_gem'; gem: Gem }
  | { action: 'discard'; item: Item }

/** `POST /team/action`. `version` is the team's version from the latest state. */
export type WireTeamRequest = { version: number; key?: string } & TeamAction

/** `POST /admin/action`. */
export type WireAdminAction =
  | { action: 'create_team'; name: string; code: string }
  | { action: 'add_member'; team: number; name: string }
  | { action: 'add_account'; team: number; member: string; rsn: string }
  | { action: 'start_game' }
  | { action: 'complete_tile'; team: number }
  | { action: 'contribute'; team: number; instance: number; key: string; amount: number }
  | { action: 'adjust_gold'; team: number; delta: number }
  | { action: 'discard_item'; team: number; item: Item }
  | { action: 'observe'; rsn: string; observation: WireObservation }
  | { action: 'revert'; seq: number }
  // Play-testing shortcuts; the server refuses them unless it runs with DEV_TOOLS=1.
  | { action: 'dev_give_item'; team: number; item: Item }
  | { action: 'dev_draw_card'; team: number; card: WireCard }
  | { action: 'dev_teleport'; team: number; tile: number }
  | { action: 'dev_freeze'; team: number; hours: number }
  | { action: 'dev_thaw'; team: number }
