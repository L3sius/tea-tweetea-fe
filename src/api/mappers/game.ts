import type { ItemTarget } from '@/domain/commands'
import type {
  Blocker,
  Card,
  Effect,
  GameState,
  Instance,
  InstanceScope,
  Match,
  MatchOutcome,
  Minigame,
  Payout,
  Pause,
  Scoring,
  Team,
  TeamStatus,
} from '@/domain/game'
import {
  challengeId,
  instanceId,
  matchId,
  minigameId,
  teamId,
  tileId,
  type InstanceId,
} from '@/domain/ids'
import type { Item } from '@/domain/vocabulary'
import type {
  WireBlocker,
  WireCard,
  WireEffect,
  WireInstance,
  WireMatch,
  WireMinigame,
  WirePayout,
  WireScoring,
  WireState,
  WireStatus,
  WireTarget,
  WireTeam,
} from '../wire/game'
import { byGemOrder, mapIdKeyed, toDate, toDateOrNull } from './shared'

export const toCard = (wire: WireCard): Card =>
  wire.suit === null ? { kind: 'joker' } : { kind: 'suited', rank: wire.rank, suit: wire.suit }

export function toEffect(wire: WireEffect): Effect {
  switch (wire.effect) {
    case 'gold':
      return { kind: 'gold', amount: wire.amount }
    case 'freeze':
      return { kind: 'freeze', hours: wire.hours }
    case 'give_item':
      return { kind: 'give_item', item: wire.item }
    case 'multiplier':
      return { kind: 'multiplier', factor: wire.factor }
    default:
      return { kind: wire.effect }
  }
}

export const toBlocker = (wire: WireBlocker): Blocker =>
  wire.blocker === 'rock' ? { kind: 'rock', until: toDate(wire.until) } : { kind: wire.blocker }

export const toScoring = (wire: WireScoring): Scoring =>
  wire.type === 'race'
    ? { kind: 'race', payouts: wire.payouts }
    : { kind: 'contribution', cap: wire.cap, goldPerUnit: wire.gold_per_unit }

export const toPayout = (wire: WirePayout): Payout => ({
  teamId: teamId(wire.team),
  gold: wire.gold,
})

export const toItemTarget = (wire: WireTarget): ItemTarget =>
  wire.target === 'team'
    ? { kind: 'team', teamId: teamId(wire.id) }
    : { kind: 'tile', tileId: tileId(wire.id) }

type WirePause = Extract<WireStatus, { status: 'moving' }>['pauses'][number]

function toPause(wire: WirePause): Pause {
  switch (wire.pause) {
    case 'shop':
      return { kind: 'shop' }
    case 'choose_opponent':
      return { kind: 'choose_opponent', candidates: wire.candidates.map(teamId) }
    case 'match':
      return {
        kind: 'match',
        matchId: wire.id === null ? null : matchId(wire.id),
        opponent: teamId(wire.opponent),
      }
  }
}

function toStatus(wire: WireStatus): TeamStatus {
  switch (wire.status) {
    case 'idle':
    case 'ready':
      return { kind: wire.status }
    case 'working':
      return { kind: 'working', instanceId: instanceId(wire.instance) }
    case 'drawn':
      return {
        kind: 'drawn',
        card: toCard(wire.card),
        steps: wire.steps,
        length: wire.length,
        destinations: wire.destinations.map(tileId),
      }
    case 'moving':
      return {
        kind: 'moving',
        move: {
          path: wire.path.map(tileId),
          atIndex: wire.at,
          pauses: wire.pauses.map(toPause),
          currentTileResolved: wire.checked,
        },
      }
  }
}

export function toTeam(wire: WireTeam): Team {
  const suitGold = wire.effects.suit_gold
  return {
    id: teamId(wire.id),
    name: wire.name,
    members: wire.members,
    position: tileId(wire.position),
    status: toStatus(wire.status),
    frozenUntil: toDateOrNull(wire.frozen_until),
    matchId: wire.match_id === null ? null : matchId(wire.match_id),
    gems: new Set(wire.gems),
    gold: wire.gold,
    // The schema only admits item names as keys.
    items: new Map(Object.entries(wire.items) as [Item, number][]),
    cardsLeft: wire.cards_left,
    effects: {
      moveMultiplier: wire.effects.multiplier,
      nextMoveHalved: wire.effects.rain,
      suitGold: suitGold && { suit: suitGold[0], drawsLeft: suitGold[1] },
      itemUsedHere: wire.effects.item_used_here,
    },
    tilesCompleted: wire.tiles_completed,
    version: wire.version,
  }
}

function toScope(wire: WireInstance['scope']): InstanceScope {
  switch (wire.scope) {
    case 'tile':
      return { kind: 'tile', teamId: teamId(wire.team), tileId: tileId(wire.tile) }
    case 'minigame':
      return { kind: 'minigame', minigameId: minigameId(wire.id) }
    case 'match':
      return { kind: 'match', matchId: matchId(wire.id) }
  }
}

export function toInstance(wire: WireInstance, id: InstanceId): Instance {
  return {
    id,
    challengeId: challengeId(wire.challenge),
    startedAt: toDate(wire.started),
    scope: toScope(wire.scope),
    progress: mapIdKeyed(wire.progress, teamId, (keys) => new Map(Object.entries(keys))),
    done: new Set(wire.done.map(teamId)),
  }
}

export function toMinigame(wire: WireMinigame): Minigame {
  return {
    id: minigameId(wire.id),
    instanceId: instanceId(wire.instance),
    scoring: toScoring(wire.scoring),
    initiator: teamId(wire.initiator),
    deadline: toDate(wire.deadline),
    finished: wire.finished.map(teamId),
    payouts: wire.gold === null ? null : wire.gold.map(toPayout),
  }
}

function toMatchOutcome(wire: WireMatch['outcome']): MatchOutcome {
  switch (wire.outcome) {
    case 'open':
    case 'abandoned':
      return { kind: wire.outcome }
    case 'stealing':
      return {
        kind: 'stealing',
        winner: teamId(wire.winner),
        loser: teamId(wire.loser),
        options: wire.options,
        deadline: toDate(wire.deadline),
      }
    case 'won':
      return { kind: 'won', winner: teamId(wire.winner), stolen: wire.stolen }
  }
}

export function toMatch(wire: WireMatch): Match {
  return {
    id: matchId(wire.id),
    instanceId: instanceId(wire.instance),
    mover: teamId(wire.mover),
    defender: teamId(wire.defender),
    deadline: toDate(wire.deadline),
    outcome: toMatchOutcome(wire.outcome),
  }
}

export function toGameState(wire: WireState): GameState {
  return {
    seq: wire.seq,
    serverTime: toDate(wire.server_time),
    phase: wire.phase,
    teams: new Map(wire.teams.map((team) => [teamId(team.id), toTeam(team)])),
    tileChallenges: new Map(wire.tiles.map((id, index) => [tileId(index), challengeId(id)])),
    gemTiles: new Map([...byGemOrder(wire.gems)].map(([gem, id]) => [gem, tileId(id)])),
    blockers: mapIdKeyed(wire.blockers, tileId, toBlocker),
    boot: wire.boot && {
      owner: teamId(wire.boot.owner),
      suit: wire.boot.suit,
      until: toDate(wire.boot.until),
    },
    instances: mapIdKeyed(wire.instances, instanceId, (value, id) =>
      toInstance(value, instanceId(id)),
    ),
    minigames: mapIdKeyed(wire.minigames, minigameId, toMinigame),
    matches: mapIdKeyed(wire.matches, matchId, toMatch),
  }
}
