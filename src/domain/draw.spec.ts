import { describe, expect, it } from 'vitest'
import { drawOutcome } from './draw'
import type { GameEvent } from './events'
import { teamId } from './ids'

const red = teamId(0)
const blue = teamId(1)
const entry = (events: GameEvent[]) => ({ seq: 1, at: new Date(0), events })

describe('drawOutcome', () => {
  it('reads the card and its steps', () => {
    const outcome = drawOutcome(
      entry([
        {
          kind: 'card_drawn',
          teamId: red,
          card: { kind: 'suited', rank: 9, suit: 'hearts' },
          steps: 18,
        },
      ]),
      red,
    )
    expect(outcome).toMatchObject({ steps: 18, freeItem: null, joker: null })
  })

  it('picks up a free item, suit gold and a Joker for the drawing team only', () => {
    const outcome = drawOutcome(
      entry([
        { kind: 'card_drawn', teamId: red, card: { kind: 'joker' }, steps: 1 },
        { kind: 'gold_changed', teamId: red, delta: 14, total: 50, reason: 'suit item' },
        { kind: 'item_gained', teamId: red, item: 'bronze_feather', reason: 'free card' },
        { kind: 'item_gained', teamId: blue, item: 'banana', reason: 'free card' },
        { kind: 'joker_effect', teamId: red, effect: { kind: 'teleport' } },
      ]),
      red,
    )
    expect(outcome).toMatchObject({
      freeItem: { item: 'bronze_feather' },
      suitGold: 14,
      joker: { kind: 'teleport' },
    })
  })

  it('notes a free item the journal keeps private', () => {
    const outcome = drawOutcome(
      entry([
        {
          kind: 'card_drawn',
          teamId: red,
          card: { kind: 'suited', rank: 7, suit: 'clubs' },
          steps: 7,
        },
        { kind: 'item_gained', teamId: red, item: null, reason: 'free card' },
      ]),
      red,
    )
    expect(outcome?.freeItem).toEqual({ item: null })
  })

  it('is null for an entry without the team’s draw', () => {
    expect(drawOutcome(entry([]), red)).toBeNull()
  })
})
