import type { Item } from '@/domain/vocabulary'
import type { WireObservation } from './activity'
import type { WireAppearance, WireCard, WireTarget } from './game'

// Request bodies are built by the client, never received, so they need types but no schemas.

type TeamAction =
  | { action: 'draw' }
  | { action: 'use_item'; item: Item; target?: WireTarget }
  | { action: 'confirm_path'; path: number[] }
  | { action: 'buy'; item: Item }
  | { action: 'buy_mystery_box' }
  | { action: 'close_shop' }
  | { action: 'discard'; item: Item }
  | { action: 'set_appearance'; appearance: WireAppearance | null }

/** `POST /team/action`. `version` is the team's version from the latest state. */
export type WireTeamRequest = { version: number; key?: string } & TeamAction

/** `POST /admin/action`. */
export type WireAdminAction =
  | { action: 'create_team'; name: string }
  | { action: 'delete_team'; team: number }
  | { action: 'rename_team'; team: number; name: string }
  | { action: 'reset_team_code'; team: number }
  | { action: 'set_withdrawn'; team: number; withdrawn: boolean }
  | { action: 'add_member'; team: number; name: string }
  | { action: 'rename_member'; team: number; member: string; name: string }
  | { action: 'remove_member'; team: number; member: string }
  | { action: 'add_account'; team: number; member: string; rsn: string }
  | { action: 'remove_account'; team: number; member: string; rsn: string }
  | { action: 'set_appearance'; team: number; appearance: WireAppearance | null }
  | { action: 'start_game' }
  | { action: 'complete_tile'; team: number; member: string }
  | { action: 'contribute'; team: number; instance: number; key: string; amount: number }
  | { action: 'adjust_gold'; team: number; delta: number }
  | { action: 'discard_item'; team: number; item: Item }
  | { action: 'give_item'; team: number; item: Item }
  | { action: 'observe'; rsn: string; observation: WireObservation }
  | { action: 'revert'; seq: number }
  // Play-testing shortcuts; the server refuses them unless it runs with DEV_TOOLS=1.
  | { action: 'dev_give_item'; team: number; item: Item }
  | { action: 'dev_draw_card'; team: number; card: WireCard }
  | { action: 'dev_teleport'; team: number; tile: number }
  | { action: 'dev_freeze'; team: number; hours: number }
  | { action: 'dev_thaw'; team: number }
