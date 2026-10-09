import { describe, expect, it } from 'vitest'
import { WirePublished } from '../wire/events'
import { toJournalEntry } from './events'

// The recorded game (see contract.spec.ts) covers most event types. These are the ones it never
// produced: lost gems, shields and the end of the game.

const at = '2026-10-05T12:00:00Z'
const deadline = '2026-10-05T18:00:00Z'

const mapOne = (event: unknown) => {
  const entry = toJournalEntry(WirePublished.parse({ seq: 1, at, events: [event] }))
  return entry.events[0]
}

describe('events missing from the recorded game', () => {
  it.each([
    [
      { type: 'gem_lost', team: 1, gem: 'red' },
      { kind: 'gem_lost', teamId: 1, gem: 'red' },
    ],
    [
      { type: 'shielded', team: 3, until: deadline },
      { kind: 'shielded', teamId: 3, until: new Date(deadline) },
    ],
    [
      {
        type: 'progress',
        instance: 4,
        team: 1,
        key: null,
        amount: 0,
        progress: { counts: {}, done: 0, target: 1, effort: 7 },
      },
      {
        kind: 'progress',
        instanceId: 4,
        teamId: 1,
        key: null,
        amount: 0,
        progress: { counts: new Map(), done: 0, target: 1, effort: 7 },
      },
    ],
    [
      { type: 'game_ended', winner: null, ranking: [2, 0, 1, 3] },
      { kind: 'game_ended', winner: null, ranking: [2, 0, 1, 3] },
    ],
  ])('maps %o', (wire, expected) => {
    expect(mapOne(wire)).toEqual(expected)
  })
})

describe('journal entries', () => {
  it('rejects an unknown event type', () => {
    const result = WirePublished.safeParse({ seq: 1, at, events: [{ type: 'dragon_slain' }] })
    expect(result.success).toBe(false)
  })

  it('maps an item used on a rival team', () => {
    expect(
      mapOne({
        type: 'item_used',
        team: 0,
        item: 'ice_barrage',
        target: { target: 'team', id: 2 },
      }),
    ).toEqual({
      kind: 'item_used',
      teamId: 0,
      item: 'ice_barrage',
      target: { kind: 'team', teamId: 2 },
    })
  })
})
