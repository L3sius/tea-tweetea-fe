import { describe, expect, it } from 'vitest'
import type { FeedItem } from './activity'
import { BURST_LIMIT, NO_FILTER, feedRows } from './feed'
import { teamId } from './ids'

const T0 = Date.parse('2026-10-06T12:00:00Z')
let nextId = 1000

function kill(rsn: string, boss: string, minutesAgo: number, value = 0): FeedItem {
  return {
    id: nextId--,
    at: new Date(T0 - minutesAgo * 60_000),
    rsn,
    teamId: teamId(0),
    kind: value > 0 ? 'loot' : 'kill_count',
    subject: boss,
    value,
    count: 1,
    observation:
      value > 0
        ? { kind: 'loot', source: boss, items: [{ name: 'Drop', quantity: 1, priceEach: value }] }
        : { kind: 'kill_count', boss, seconds: null },
  }
}

describe('feedRows', () => {
  it('merges repeats of the same thing by the same player', () => {
    const rows = feedRows(
      [kill('A', 'Zulrah', 0), kill('A', 'Zulrah', 2), kill('A', 'Zulrah', 4)],
      NO_FILTER,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'item', count: 3 })
  })

  it('folds a player’s burst past the limit but keeps other players visible', () => {
    const items = [
      kill('A', 'b1', 0),
      kill('A', 'b2', 1),
      kill('A', 'b3', 2),
      kill('B', 'b1', 3),
      kill('A', 'b4', 4),
      kill('A', 'b5', 5),
    ]
    const rows = feedRows(items, NO_FILTER)
    const shownA = rows.filter((r) => r.kind === 'item' && r.item.rsn === 'A')
    expect(shownA).toHaveLength(BURST_LIMIT)
    expect(rows.some((r) => r.kind === 'item' && r.item.rsn === 'B')).toBe(true)
    expect(rows.find((r) => r.kind === 'folded')).toMatchObject({ rsn: 'A', hidden: { length: 2 } })
  })

  it('shows everything for an expanded player', () => {
    const items = [0, 1, 2, 3, 4].map((m) => kill('A', `b${m}`, m))
    expect(feedRows(items, NO_FILTER, new Set(['A']))).toHaveLength(5)
  })

  it('filters by minimum value', () => {
    const items = [kill('A', 'x', 0, 50_000), kill('B', 'y', 1, 2_000_000)]
    const rows = feedRows(items, { ...NO_FILTER, minValue: 1_000_000 })
    expect(rows).toHaveLength(1)
  })
})
