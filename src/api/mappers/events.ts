import type { GameEvent, JournalEntry } from '@/domain/events'
import { challengeId, instanceId, matchId, minigameId, teamId, tileId } from '@/domain/ids'
import type { WireEvent, WirePublished } from '../wire/events'
import {
  toBlocker,
  toCard,
  toEffect,
  toItemTarget,
  toPayout,
  toScoring,
  toTeamProgress,
} from './game'
import { toDate } from './shared'

export function toGameEvent(wire: WireEvent): GameEvent {
  switch (wire.type) {
    case 'team_created':
      return { kind: wire.type, teamId: teamId(wire.team), name: wire.name }
    case 'member_added':
      return { kind: wire.type, teamId: teamId(wire.team), member: wire.member }
    case 'account_added':
      return { kind: wire.type, teamId: teamId(wire.team), member: wire.member, rsn: wire.rsn }
    case 'game_started':
      return {
        kind: wire.type,
        tileChallenges: wire.tiles.map(challengeId),
        gemTiles: wire.gems.map(tileId),
        positions: wire.positions.map(tileId),
      }
    case 'game_ended':
      return {
        kind: wire.type,
        winner: wire.winner === null ? null : teamId(wire.winner),
        ranking: wire.ranking.map(teamId),
      }
    case 'card_drawn':
      return {
        kind: wire.type,
        teamId: teamId(wire.team),
        card: toCard(wire.card),
        steps: wire.steps,
      }
    case 'paths_offered':
      return {
        kind: wire.type,
        teamId: teamId(wire.team),
        length: wire.length,
        destinations: wire.destinations.map(tileId),
      }
    case 'move_confirmed':
      return { kind: wire.type, teamId: teamId(wire.team), path: wire.path.map(tileId) }
    case 'stepped':
      return { kind: wire.type, teamId: teamId(wire.team), tileId: tileId(wire.tile) }
    case 'landed':
      return {
        kind: wire.type,
        teamId: teamId(wire.team),
        tileId: tileId(wire.tile),
        instanceId: instanceId(wire.instance),
      }
    case 'teleported':
      return {
        kind: wire.type,
        teamId: teamId(wire.team),
        from: tileId(wire.from),
        to: tileId(wire.to),
      }
    case 'trap_triggered':
      return {
        kind: wire.type,
        teamId: teamId(wire.team),
        tileId: tileId(wire.tile),
        trap: toBlocker(wire.trap),
        to: tileId(wire.to),
      }
    case 'progress':
      return {
        kind: wire.type,
        instanceId: instanceId(wire.instance),
        teamId: teamId(wire.team),
        key: wire.key || null,
        amount: wire.amount,
        progress: toTeamProgress(wire.progress),
      }
    case 'tile_completed':
      return { kind: wire.type, teamId: teamId(wire.team), tileId: tileId(wire.tile) }
    case 'gem_collected':
      return {
        kind: wire.type,
        teamId: teamId(wire.team),
        gem: wire.gem,
        tileId: tileId(wire.tile),
      }
    case 'gem_lost':
    case 'necklace_used':
      return { kind: wire.type, teamId: teamId(wire.team), gem: wire.gem }
    case 'gem_stolen':
      return { kind: wire.type, from: teamId(wire.from), to: teamId(wire.to), gem: wire.gem }
    case 'shop_opened':
      return { kind: wire.type, teamId: teamId(wire.team), tileId: tileId(wire.tile) }
    case 'shop_closed':
    case 'thawed':
      return { kind: wire.type, teamId: teamId(wire.team) }
    case 'bought':
      return { kind: wire.type, teamId: teamId(wire.team), item: wire.item, price: wire.price }
    // Apart, since TypeScript stops matching a merged kind against the union past 25 item values.
    case 'item_gained':
      return { kind: wire.type, teamId: teamId(wire.team), item: wire.item, reason: wire.reason }
    case 'item_lost':
      return { kind: wire.type, teamId: teamId(wire.team), item: wire.item, reason: wire.reason }
    case 'item_used':
      return {
        kind: wire.type,
        teamId: teamId(wire.team),
        item: wire.item,
        target: wire.target === null ? null : toItemTarget(wire.target),
      }
    case 'gold_changed':
      return {
        kind: wire.type,
        teamId: teamId(wire.team),
        delta: wire.delta,
        total: wire.total,
        reason: wire.reason,
      }
    case 'blocker_placed':
      return {
        kind: wire.type,
        tileId: tileId(wire.tile),
        blocker: toBlocker(wire.blocker),
        by: teamId(wire.by),
      }
    case 'blocker_removed':
      return { kind: wire.type, tileId: tileId(wire.tile) }
    case 'frozen':
    case 'shielded':
      return { kind: wire.type, teamId: teamId(wire.team), until: toDate(wire.until) }
    case 'random_event':
      return {
        kind: wire.type,
        teamId: teamId(wire.team),
        id: wire.id,
        title: wire.title,
        text: wire.text,
        effect: toEffect(wire.effect),
      }
    case 'joker_effect':
      return { kind: wire.type, teamId: teamId(wire.team), effect: toEffect(wire.effect) }
    case 'minigame_opened':
      return {
        kind: wire.type,
        minigameId: minigameId(wire.id),
        challengeId: challengeId(wire.challenge),
        scoring: toScoring(wire.scoring),
        initiator: teamId(wire.initiator),
        deadline: toDate(wire.deadline),
      }
    case 'minigame_finished':
      return {
        kind: wire.type,
        minigameId: minigameId(wire.id),
        teamId: teamId(wire.team),
        place: wire.place,
      }
    case 'minigame_closed':
      return { kind: wire.type, minigameId: minigameId(wire.id), payouts: wire.gold.map(toPayout) }
    case 'opponent_choice':
      return {
        kind: wire.type,
        teamId: teamId(wire.team),
        candidates: wire.candidates.map(teamId),
      }
    case 'match_started':
      return {
        kind: wire.type,
        matchId: matchId(wire.id),
        mover: teamId(wire.mover),
        defender: teamId(wire.defender),
        challengeId: challengeId(wire.challenge),
        deadline: toDate(wire.deadline),
      }
    case 'match_won':
      return {
        kind: wire.type,
        matchId: matchId(wire.id),
        winner: teamId(wire.winner),
        loser: teamId(wire.loser),
        options: wire.options,
      }
    case 'match_abandoned':
      return {
        kind: wire.type,
        matchId: matchId(wire.id),
        mover: teamId(wire.mover),
        defender: teamId(wire.defender),
      }
  }
}

export const toJournalEntry = (wire: WirePublished): JournalEntry => ({
  seq: wire.seq,
  at: toDate(wire.at),
  events: wire.events.map(toGameEvent),
})
