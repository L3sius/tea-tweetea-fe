// What a draw did, read from the journal entry the `draw` command produced.
import type { JournalEntry } from './events'
import type { Card, Effect } from './game'
import type { TeamId } from './ids'
import type { Item } from './vocabulary'

export type DrawOutcome = {
  card: Card
  /** Tiles to walk after multipliers and rain. */
  steps: number
  /** 7s and Aces give a free item (lost if the inventory is full). */
  freeItem: Item | null
  /** Gold from a Club Hat or Heart Glove. */
  suitGold: number
  joker: Effect | null
}

export function drawOutcome(entry: JournalEntry, team: TeamId): DrawOutcome | null {
  let outcome: DrawOutcome | null = null
  for (const event of entry.events) {
    if (event.kind === 'card_drawn' && event.teamId === team) {
      outcome = {
        card: event.card,
        steps: event.steps,
        freeItem: null,
        suitGold: 0,
        joker: null,
      }
      continue
    }
    if (!outcome) continue
    if (event.kind === 'item_gained' && event.teamId === team && event.reason === 'free card')
      outcome.freeItem = event.item
    else if (event.kind === 'gold_changed' && event.teamId === team && event.reason === 'suit item')
      outcome.suitGold += event.delta
    else if (event.kind === 'joker_effect' && event.teamId === team) outcome.joker = event.effect
  }
  return outcome
}
