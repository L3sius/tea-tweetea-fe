// Which OSRS sound each moment of the game makes, and who hears it. The files are public/sounds/
// <name>.ogg (see the README). Big moments are for everyone watching; small ones only for the
// team they happen to, so four teams playing at once never turn into noise.
import type { GameEvent, JournalEntry } from './events'
import type { TeamId } from './ids'
import type { Item } from './vocabulary'

export const SOUNDS = [
  'card-turn',
  'joker',
  'free-item',
  'ice-barrage-cast',
  'ice-barrage-impact',
  'entangle-cast',
  'entangle-hit',
  'axe-throw',
  'feather-wind',
  'quetzal-whistle',
  'ogre-boat',
  'group-teleport',
  'banana-place',
  'swarm-place',
  'snake-charm',
  'web-place',
  'banana-slip',
  'swarm-hit',
  'stunned',
  'web-stuck',
  'protect-from-magic',
  'necklace-save',
  'item-drop',
  'teleport',
  'thaw',
  'coins',
  'coins-recorded',
  'casket-open',
  'level-up',
  'thieving',
  'oh-dear',
  'fanfare',
  'horn',
  'victory',
  'genie',
  'quest-complete',
] as const
export type SoundName = (typeof SOUNDS)[number]

/** `everyone`: anyone watching hears it. `team`: only the team it is about, or whoever follows it. */
export type SoundAudience = 'everyone' | 'team'

export type SoundFor = { sound: SoundName; team: TeamId; audience: SoundAudience }

/** The sound of using each item, for the team that uses it. */
const ITEM_SOUNDS: Partial<Record<Item, { sound: SoundName; audience: SoundAudience }>> = {
  ice_barrage: { sound: 'ice-barrage-cast', audience: 'everyone' },
  entangle: { sound: 'entangle-cast', audience: 'everyone' },
  morrigans_throwing_axe: { sound: 'axe-throw', audience: 'everyone' },
  bronze_feather: { sound: 'feather-wind', audience: 'team' },
  silver_feather: { sound: 'feather-wind', audience: 'team' },
  gold_feather: { sound: 'feather-wind', audience: 'team' },
  quetzal_whistle: { sound: 'quetzal-whistle', audience: 'everyone' },
  ogre_boat: { sound: 'ogre-boat', audience: 'everyone' },
  group_teleport: { sound: 'group-teleport', audience: 'everyone' },
  banana: { sound: 'banana-place', audience: 'everyone' },
  harpie_bug_swarm: { sound: 'swarm-place', audience: 'everyone' },
  snake_charmer: { sound: 'snake-charm', audience: 'everyone' },
  wilderness_web: { sound: 'web-place', audience: 'everyone' },
}

/** What a team that walks onto each blocker hears as it stops. */
const BLOCKER_SOUNDS: Partial<Record<Item, SoundName>> = {
  banana: 'banana-slip',
  harpie_bug_swarm: 'swarm-hit',
  snake_charmer: 'stunned',
  wilderness_web: 'web-stuck',
}

/** Items whose own sound already tells of the teleport that follows. */
const TELEPORT_ITEMS = new Set<Item>(['quetzal_whistle', 'ogre_boat', 'group_teleport'])

/** What the rest of an entry says about an event in it: the item used, a blocker hit. */
type Context = { itemUsed: Item | null; blockerHit: boolean }

export function entryContext(entry: JournalEntry): Context {
  let itemUsed: Item | null = null
  let blockerHit = false
  for (const e of entry.events) {
    if (e.kind === 'item_used') itemUsed = e.item
    if (e.kind === 'blocker_triggered') blockerHit = true
  }
  return { itemUsed, blockerHit }
}

const everyone = (sound: SoundName, team: TeamId): SoundFor => ({
  sound,
  team,
  audience: 'everyone',
})
const forTeam = (sound: SoundName, team: TeamId): SoundFor => ({ sound, team, audience: 'team' })

/** The sound an event makes, if any. `context` is what else happened in its journal entry. */
export function soundFor(event: GameEvent, context: Context): SoundFor | null {
  switch (event.kind) {
    case 'card_drawn':
      return event.card.kind === 'joker'
        ? everyone('joker', event.teamId)
        : forTeam('card-turn', event.teamId)
    case 'item_gained':
      return event.reason === 'free card' ? forTeam('free-item', event.teamId) : null
    case 'item_used': {
      const s = ITEM_SOUNDS[event.item]
      return s ? { ...s, team: event.teamId } : null
    }
    case 'frozen':
      // A blocker's own sound tells of its freeze; a spell's hit is its own.
      if (context.blockerHit) return null
      if (context.itemUsed === 'entangle') return everyone('entangle-hit', event.teamId)
      if (context.itemUsed === 'ice_barrage') return everyone('ice-barrage-impact', event.teamId)
      return everyone('stunned', event.teamId)
    case 'blocker_triggered': {
      const sound = BLOCKER_SOUNDS[event.blocker.item]
      return sound ? everyone(sound, event.teamId) : null
    }
    case 'item_lost':
      if (event.reason === 'blocked a freeze') return everyone('protect-from-magic', event.teamId)
      if (event.reason === 'discarded') return forTeam('item-drop', event.teamId)
      return null
    case 'necklace_used':
      return everyone('necklace-save', event.teamId)
    case 'teleported':
      if (context.itemUsed && TELEPORT_ITEMS.has(context.itemUsed)) return null
      return everyone('teleport', event.teamId)
    case 'thawed':
      return forTeam('thaw', event.teamId)
    case 'shop_opened':
      return forTeam('coins', event.teamId)
    case 'bought':
      return forTeam('coins-recorded', event.teamId)
    case 'gem_collected':
      return everyone('level-up', event.teamId)
    case 'gem_stolen':
      return everyone('thieving', event.to)
    case 'gem_lost':
      return everyone('oh-dear', event.teamId)
    case 'tile_completed':
      return forTeam('fanfare', event.teamId)
    case 'minigame_opened':
      return everyone('horn', event.initiator)
    case 'match_won':
      return everyone('victory', event.winner)
    case 'random_event':
      return everyone('genie', event.teamId)
    case 'game_ended':
      return event.winner === null ? null : everyone('quest-complete', event.winner)
    default:
      return null
  }
}
