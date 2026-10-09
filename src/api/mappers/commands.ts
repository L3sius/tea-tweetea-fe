import type { Drop, Observation } from '@/domain/activity'
import type { AdminCommand, ItemTarget, TeamCommand } from '@/domain/commands'
import type { Card } from '@/domain/game'
import type { WireAdminAction, WireTeamRequest } from '../wire/commands'
import type { WireObservation } from '../wire/activity'
import type { WireCard, WireTarget } from '../wire/game'

const toWireCard = (card: Card): WireCard =>
  card.kind === 'joker' ? { rank: 0, suit: null } : { rank: card.rank, suit: card.suit }

const toWireTarget = (target: ItemTarget): WireTarget =>
  target.kind === 'team'
    ? { target: 'team', id: target.teamId }
    : { target: 'tile', id: target.tileId }

export function toWireTeamRequest(
  command: TeamCommand,
  version: number,
  idempotencyKey: string,
): WireTeamRequest {
  const base = { version, key: idempotencyKey }
  switch (command.kind) {
    case 'use_item':
      return command.target === undefined
        ? { ...base, action: 'use_item', item: command.item }
        : { ...base, action: 'use_item', item: command.item, target: toWireTarget(command.target) }
    case 'draw':
    case 'buy_mystery_box':
    case 'close_shop':
      return { ...base, action: command.kind }
    case 'confirm_path':
      return { ...base, action: command.kind, path: command.path }
    case 'buy':
    case 'discard':
      return { ...base, action: command.kind, item: command.item }
    case 'choose_opponent':
      return { ...base, action: command.kind, opponent: command.opponent }
    case 'steal_gem':
      return { ...base, action: command.kind, gem: command.gem }
    case 'set_appearance':
      return { ...base, action: command.kind, appearance: command.appearance }
  }
}

const toWireDrop = (drop: Drop) => ({
  name: drop.name,
  quantity: drop.quantity,
  price_each: drop.priceEach,
})

function toWireObservation(observation: Observation): WireObservation {
  switch (observation.kind) {
    case 'loot':
      return { kind: 'loot', source: observation.source, items: observation.items.map(toWireDrop) }
    case 'clue':
      return {
        kind: 'clue',
        tier: observation.tier,
        items: observation.items.map(toWireDrop),
        region: observation.region,
      }
    case 'kill_count':
    case 'slayer':
    case 'pet':
    case 'combat_achievement':
      return observation
  }
}

export function toWireAdminAction(command: AdminCommand): WireAdminAction {
  switch (command.kind) {
    case 'create_team':
      return { action: command.kind, name: command.name, code: command.code }
    case 'add_member':
      return { action: command.kind, team: command.teamId, name: command.name }
    case 'add_account':
      return {
        action: command.kind,
        team: command.teamId,
        member: command.member,
        rsn: command.rsn,
      }
    case 'set_appearance':
      return { action: command.kind, team: command.teamId, appearance: command.appearance }
    case 'start_game':
      return { action: command.kind }
    case 'complete_tile':
      return { action: command.kind, team: command.teamId }
    case 'contribute':
      return {
        action: command.kind,
        team: command.teamId,
        instance: command.instanceId,
        key: command.key,
        amount: command.amount,
      }
    case 'adjust_gold':
      return { action: command.kind, team: command.teamId, delta: command.delta }
    case 'discard_item':
      return { action: command.kind, team: command.teamId, item: command.item }
    case 'observe':
      return {
        action: command.kind,
        rsn: command.rsn,
        observation: toWireObservation(command.observation),
      }
    case 'revert':
      return { action: command.kind, seq: command.seq }
    case 'dev_give_item':
      return { action: command.kind, team: command.teamId, item: command.item }
    case 'dev_draw_card':
      return { action: command.kind, team: command.teamId, card: toWireCard(command.card) }
    case 'dev_teleport':
      return { action: command.kind, team: command.teamId, tile: command.tileId }
    case 'dev_freeze':
      return { action: command.kind, team: command.teamId, hours: command.hours }
    case 'dev_thaw':
      return { action: command.kind, team: command.teamId }
  }
}
