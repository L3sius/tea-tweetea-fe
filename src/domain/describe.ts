// Plain-English text for game values, shared by every screen. Pure functions, no Vue.
import type { Drop, Observation } from './activity'
import type { Challenge, Criterion } from './challenge'
import type { GameEvent } from './events'
import type { Blocker, Card, Effect, Instance, Team, TeamProgress } from './game'
import type { ChallengeId, TeamId } from './ids'
import { itemEntry } from './items'
import { NECKLACES, type Item, type Suit } from './vocabulary'

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

/** The item's name from the server's catalogue. */
export const itemName = (item: Item): string => itemEntry(item).name

export function blockerName(blocker: Blocker): string {
  switch (blocker.kind) {
    case 'banana':
      return 'Banana'
    case 'swarm':
      return 'Harpie bug swarm'
    case 'snake':
      return 'Snake charmer'
    case 'web':
      return 'Wilderness web'
  }
}

/** `seesItems`: whether the viewer may know which item a gift was (its own team's only). */
export function effectText(effect: Effect, seesItems = true): string {
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
      return `gets ${effect.item && seesItems ? a(itemName(effect.item)) : 'an item'}`
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
      return criterion.tasks.map((task) => task.name)
    case 'timed_kill':
      return [criterion.boss]
  }
}

export type Progress = { done: number; needed: number }

/**
 * How far a team is through a challenge: the server's own `done / target`. Before the team has a
 * standing on the instance, nothing is done and the goal says what is needed.
 */
export function challengeProgress(
  challenge: Challenge,
  instance: Instance | undefined,
  team: TeamId,
): Progress {
  const standing = instance?.progress.get(team)
  if (standing) return { done: standing.done, needed: standing.target }
  const { goal } = challenge
  const keys = goal.kind === 'each' ? progressKeys(challenge.criterion).length : 1
  return { done: 0, needed: goal.n * Math.max(keys, 1) }
}

/**
 * The effort a team has spent on a task, as a short label ("312 kills", "best 27:14 / 26:00",
 * "working 3h 12m"). Null when there is no instance to measure, or when the effort counts the very
 * thing the task counts (kills for a kill-count task, caskets for a casket count), since the
 * progress bar already says it. It never decides completion.
 */
export function effortText(
  challenge: Challenge,
  instance: Instance | undefined,
  standing: TeamProgress | undefined,
  now: Date,
): string | null {
  if (!instance) return null
  const effort = standing?.effort ?? null
  const { criterion } = challenge
  if (duplicatesProgress(challenge)) return null
  switch (challenge.effort.kind) {
    case 'kills':
    case 'loots':
      return plural(effort ?? 0, 'kill')
    case 'caskets':
      return plural(effort ?? 0, 'casket')
    case 'best_time': {
      const limit = criterion.kind === 'timed_kill' ? ` / ${duration(criterion.maxSeconds)}` : ''
      return effort === null ? 'no time yet' : `best ${duration(effort)}${limit}`
    }
    case 'elapsed':
      return `working ${elapsed(now.getTime() - instance.startedAt.getTime())}`
  }
}

/** Whether a task's effort is the same count its progress bar shows. */
function duplicatesProgress({ criterion, effort }: Challenge): boolean {
  if (criterion.kind === 'kill_count') return effort.kind === 'kills'
  if (criterion.kind === 'clue')
    return effort.kind === 'caskets' && criterion.filter.kind === 'count'
  return false
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

const elapsed = (ms: number) => {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  const hours = Math.floor(minutes / 60)
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`
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
  /** Whether the viewer may know what items this team holds: only its own players may. */
  seesItems(id: TeamId): boolean
}

/**
 * One line for the game log, or `null` for bookkeeping events that would only add noise
 * (single steps, progress ticks, offered paths).
 */
export function describeEvent(event: GameEvent, names: Names): string | null {
  const team = (id: TeamId) => names.team(id)
  // What a team gains, buys or loses stays private: other viewers learn only that it was an item.
  // Using one is public, since everyone sees what it does. The server blanks private items too.
  const held = (id: TeamId, item: Item | null) =>
    item && names.seesItems(id) ? a(itemName(item)) : 'an item'
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
    case 'tile_completed':
      return `${team(event.teamId)} completed a tile`
    case 'gem_collected':
      return `${team(event.teamId)} collected the ${event.gem} gem`
    case 'gem_lost':
      return `${team(event.teamId)} lost the ${event.gem} gem`
    case 'gem_stolen':
      return `${team(event.to)} stole the ${event.gem} gem from ${team(event.from)}`
    case 'necklace_used':
      return `${team(event.teamId)}’s ${itemName(NECKLACES[event.gem])} saved the ${event.gem} gem`
    case 'shop_opened':
      return `${team(event.teamId)} entered a shop`
    case 'bought':
      return `${team(event.teamId)} bought ${held(event.teamId, event.item)} for ${event.price} gold`
    case 'item_gained':
      return `${team(event.teamId)} got ${held(event.teamId, event.item)}`
    case 'item_lost':
      switch (event.reason) {
        case 'blocked a freeze':
          return `${team(event.teamId)}’s ${event.item ? itemName(event.item) : 'item'} blocked a freeze`
        case 'inventory full':
          return `${team(event.teamId)}’s inventory was full, so ${held(event.teamId, event.item)} was lost`
        // Told by `item_used` and `necklace_used`.
        case 'used':
        case 'protected a gem':
          return null
        default:
          return `${team(event.teamId)} lost ${held(event.teamId, event.item)}`
      }
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
    case 'frozen':
      return `${team(event.teamId)} is frozen until ${clock(event.until)}`
    case 'shielded':
      return `${team(event.teamId)} is shielded from hostile items until ${clock(event.until)}`
    case 'thawed':
      return `${team(event.teamId)} thawed out`
    case 'random_event':
      return `${event.title}: ${team(event.teamId)} ${effectText(event.effect, names.seesItems(event.teamId))}`
    case 'joker_effect':
      return `Joker! ${team(event.teamId)} ${effectText(event.effect, names.seesItems(event.teamId))}`
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
