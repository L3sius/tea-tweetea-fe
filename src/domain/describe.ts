// Plain-English text for game values, shared by every screen. Pure functions, no Vue.
import type { Drop, Observation } from './activity'
import type { Challenge, Criterion } from './challenge'
import type { GameEvent } from './events'
import type { Blocker, Card, Effect, Instance, Team } from './game'
import type { ChallengeId, TeamId } from './ids'
import type { Item, Suit } from './vocabulary'

const SUIT_SYMBOLS: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
}

const FACES: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }

export function cardLabel(card: Card): string {
  if (card.kind === 'joker') return 'Joker'
  return `${FACES[card.rank] ?? String(card.rank)}${SUIT_SYMBOLS[card.suit]}`
}

/** Names as the rulebook gives them; the rest are the item id in title case. */
const ITEM_NAMES: Partial<Record<Item, string>> = {
  owls_feather: "Owl's Feather",
  phoenix_feather: "Phoenix's Feather",
  harp_of_rain: 'Harp to Call Rain',
  bird_whistle: 'Whistle to Call a Bird',
  whale_whistle: 'Whistle to Call a Whale',
  turtle_whistle: "Turtle Handler's Whistle",
  royal_ring: "Royal Family's Ring",
  bee_whistle: 'Whistle to Call a Bee',
  snake_whistle: 'Whistle to Call a Snake',
  giants_lamp: "Giant's Lamp",
  monks_ring: "Monk's Ring",
  monks_pendant: "Monk's Pendant",
}

export function itemName(item: Item): string {
  return ITEM_NAMES[item] ?? titleCase(item.replaceAll('_', ' '))
}

export function blockerName(blocker: Blocker): string {
  switch (blocker.kind) {
    case 'banana':
      return 'Banana peel'
    case 'bees':
      return 'Bees'
    case 'snake':
      return 'Snake'
    case 'rock':
      return 'Rock'
  }
}

export function effectText(effect: Effect): string {
  switch (effect.kind) {
    case 'lose_gem':
      return 'loses a gem'
    case 'teleport':
      return 'is teleported'
    case 'halve_gold':
      return 'loses half its gold'
    case 'gold':
      return effect.amount >= 0 ? `gains ${effect.amount} gold` : `loses ${-effect.amount} gold`
    case 'freeze':
      return `is frozen for ${effect.hours}h`
    case 'give_item':
      return `gets ${a(itemName(effect.item))}`
    case 'lose_random_item':
      return 'loses a random item'
    case 'multiplier':
      return `moves ×${effect.factor} next time`
    case 'nothing':
      return 'is unaffected'
  }
}

/** The progress keys a challenge counts separately, for `each` goals. */
function progressKeys(criterion: Criterion): string[] {
  switch (criterion.kind) {
    case 'loot':
      return criterion.filter.kind === 'items' ? criterion.filter.items.map((i) => i.name) : []
    case 'clue':
      return criterion.filter.kind === 'items' ? criterion.filter.items : []
    case 'kill_count':
      return criterion.bosses
    case 'slayer':
      return criterion.tasks
    case 'pet':
      return criterion.pets
    case 'combat_achievement':
      return criterion.tasks
    case 'timed_kill':
      return [criterion.boss]
  }
}

export type Progress = { done: number; needed: number }

/** How far a team is through a challenge, counting each contribution up to what the goal needs. */
export function challengeProgress(
  challenge: Challenge,
  instance: Instance | undefined,
  team: TeamId,
): Progress {
  const counts = instance?.progress.get(team) ?? new Map<string, number>()
  const { goal } = challenge
  if (goal.kind === 'total') {
    const sum = [...counts.values()].reduce((a, b) => a + b, 0)
    return { done: Math.min(sum, goal.n), needed: goal.n }
  }
  const keys = progressKeys(challenge.criterion)
  const counted = keys.length > 0 ? keys : [...counts.keys()]
  const needed = goal.n * Math.max(counted.length, 1)
  const done = counted.reduce((sum, key) => sum + Math.min(counts.get(key) ?? 0, goal.n), 0)
  return { done, needed }
}

/** What a team is doing right now, in a few words. */
export function teamStatusText(team: Team, now: Date, names: Names): string {
  if (team.frozenUntil && team.frozenUntil > now) return `Frozen until ${clock(team.frozenUntil)}`
  if (team.matchId !== null) return 'In a match'
  const { status } = team
  switch (status.kind) {
    case 'idle':
      return 'Waiting for the game to start'
    case 'ready':
      return 'Ready to draw a card'
    case 'working':
      return 'Working on a tile'
    case 'drawn':
      return `Drew ${cardLabel(status.card)}, choosing where to go (${status.length} steps)`
    case 'moving': {
      const pause = status.move.pauses[0]
      if (!pause) return 'On the move'
      switch (pause.kind) {
        case 'shop':
          return 'Shopping'
        case 'choose_opponent':
          return 'Choosing an opponent'
        case 'match':
          return `Facing ${names.team(pause.opponent)}`
      }
    }
  }
}

export type Names = {
  team(id: TeamId): string
  challenge(id: ChallengeId): string
}

/**
 * One line for the game log, or `null` for bookkeeping events that would only add noise
 * (single steps, progress ticks, offered paths).
 */
export function describeEvent(event: GameEvent, names: Names): string | null {
  const team = (id: TeamId) => names.team(id)
  switch (event.kind) {
    case 'team_created':
      return `${event.name} joined the game`
    case 'member_added':
      return `${event.member} joined ${team(event.teamId)}`
    case 'account_added':
      return null
    case 'game_started':
      return 'The game has started!'
    case 'game_ended':
      return event.winner === null ? 'The game has ended' : `${team(event.winner)} won the game!`
    case 'card_drawn':
      return `${team(event.teamId)} drew ${cardLabel(event.card)} (${event.steps} steps)`
    case 'paths_offered':
    case 'stepped':
    case 'progress':
    case 'shop_closed':
    case 'opponent_choice':
      return null
    case 'move_confirmed':
      return `${team(event.teamId)} set off ${event.path.length - 1} tiles`
    case 'landed':
      return `${team(event.teamId)} landed on a new tile`
    case 'teleported':
      return `${team(event.teamId)} was teleported`
    case 'trap_triggered':
      return `${team(event.teamId)} hit ${a(blockerName(event.trap).toLowerCase())}`
    case 'tile_restarted':
      return `${team(event.teamId)} has to restart its tile`
    case 'tile_completed':
      return `${team(event.teamId)} completed a tile`
    case 'gem_collected':
      return `${team(event.teamId)} collected the ${event.gem} gem`
    case 'gem_lost':
      return `${team(event.teamId)} lost the ${event.gem} gem`
    case 'gem_stolen':
      return `${team(event.to)} stole the ${event.gem} gem from ${team(event.from)}`
    case 'bell_used':
      return `${team(event.teamId)} rang the ${event.gem} bell`
    case 'shop_opened':
      return `${team(event.teamId)} entered a shop`
    case 'bought':
      return `${team(event.teamId)} bought ${a(itemName(event.item))} for ${event.price} gold`
    case 'item_gained':
      return `${team(event.teamId)} got ${a(itemName(event.item))}`
    case 'item_lost':
      return event.reason === 'blocked a freeze'
        ? `${team(event.teamId)}’s ${itemName(event.item)} blocked a freeze`
        : `${team(event.teamId)} lost ${a(itemName(event.item))}`
    case 'item_used':
      return `${team(event.teamId)} used ${a(itemName(event.item))}`
    case 'gold_changed':
      return event.delta >= 0
        ? `${team(event.teamId)} earned ${event.delta} gold`
        : `${team(event.teamId)} spent ${-event.delta} gold`
    case 'blocker_placed':
      return `${team(event.by)} placed ${a(blockerName(event.blocker).toLowerCase())}`
    case 'blocker_removed':
      return null
    case 'boot_started':
      return `${team(event.owner)} put on a ${event.suit} boot until ${clock(event.until)}`
    case 'boot_ended':
      return 'The boot wore off'
    case 'frozen':
      return `${team(event.teamId)} is frozen until ${clock(event.until)}`
    case 'thawed':
      return `${team(event.teamId)} thawed out`
    case 'random_event':
      return `${event.title}: ${team(event.teamId)} ${effectText(event.effect)}`
    case 'joker_effect':
      return `Joker! ${team(event.teamId)} ${effectText(event.effect)}`
    case 'minigame_opened':
      return `${team(event.initiator)} opened a minigame: ${names.challenge(event.challengeId)}`
    case 'minigame_finished':
      return `${team(event.teamId)} finished the minigame in place ${event.place}`
    case 'minigame_closed':
      return 'A minigame closed'
    case 'match_started':
      return `${team(event.mover)} challenged ${team(event.defender)}: ${names.challenge(event.challengeId)}`
    case 'match_won':
      return `${team(event.winner)} beat ${team(event.loser)}`
    case 'match_abandoned':
      return `The match between ${team(event.mover)} and ${team(event.defender)} was abandoned`
  }
}

/** What a player did, without the player's name: "got Bandos chestplate from General Graardor". */
export function observationText(observation: Observation): string {
  switch (observation.kind) {
    case 'loot': {
      const [first, ...rest] = observation.items
      const what = first
        ? dropText(first) + (rest.length > 0 ? ` and ${rest.length} more` : '')
        : 'loot'
      return `got ${what} from ${observation.source}`
    }
    case 'clue':
      return observation.tier === 'any'
        ? 'opened a clue casket'
        : `opened ${a(observation.tier)} clue casket`
    case 'kill_count':
      return observation.seconds === null
        ? `killed ${observation.boss}`
        : `killed ${observation.boss} in ${duration(observation.seconds)}`
    case 'slayer':
      return `finished ${a(observation.task)} slayer task`
    case 'pet':
      return `got a pet: ${observation.name}!`
    case 'combat_achievement':
      return `completed ${observation.task}`
  }
}

const dropText = (drop: Drop) => (drop.quantity > 1 ? `${drop.quantity} × ${drop.name}` : drop.name)

const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`

export const clock = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

/** "a" or "an", by how the word is spelled, which covers every name in the game. */
const a = (word: string) => `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`

const titleCase = (text: string) => text.replace(/\b\w/g, (c) => c.toUpperCase())
