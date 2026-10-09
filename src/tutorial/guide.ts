// Earl Grey, the tutorial's guide: an OSRS NPC who walks the board like a team's piece.
import { teamId } from '@/domain/ids'

export const GUIDE = {
  name: 'Earl Grey',
  /** Sir Pear Visor. */
  npc: 12122,
  idle: 808,
  walk: 819,
  run: 824,
} as const

/** The guide moves through a Choreography of his own, under an id no team has. */
export const GUIDE_TEAM = teamId(-1)

/** Where he starts: the tile nearest Lumbridge, where every adventure begins (world x, y). */
export const LUMBRIDGE = { x: 3222, y: 3218 }
