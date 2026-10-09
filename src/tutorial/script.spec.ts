import { describe, expect, it } from 'vitest'
import { ROSTER } from '@/characters/roster'
import type { Board } from '@/domain/board'
import { tileId } from '@/domain/ids'
import { pathFrom } from '@/stores/tutorial'
import { GUIDE } from './guide'
import { GESTURE, TUTORIAL } from './script'

describe('the tutorial script', () => {
  it("only uses animations the export ships (it ships the roster's)", () => {
    const shipped = new Set([
      ...Object.values(ROSTER.styles).flatMap((options) => options.map((o) => o.id)),
      ...Object.values(ROSTER.reactions).flat(),
      ...ROSTER.easterEggs.idle,
    ])
    const used = [...Object.values(GESTURE), GUIDE.idle, GUIDE.walk, GUIDE.run]
    expect(used.filter((id) => !shipped.has(id))).toEqual([])
  })

  it('gives every beat something to say', () => {
    expect(TUTORIAL.every((beat) => beat.lines.length > 0)).toBe(true)
  })
})

describe('pathFrom', () => {
  // A crossroads at 1: 0 west, 2 east, 3 further east, 4 north.
  const tiles = [
    [0, -1, 0],
    [1, 0, 0],
    [2, 1, 0],
    [3, 2, 0],
    [4, 0, 1],
  ] as const
  const board = {
    tiles: new Map(
      tiles.map(([id, x, y]) => [tileId(id), { id: tileId(id), x, y, kind: 'normal' }]),
    ),
    roads: [
      [0, 1],
      [1, 2],
      [2, 3],
      [1, 4],
    ].map(([a, b]) => [tileId(a ?? 0), tileId(b ?? 0)]),
  } as unknown as Board

  it('walks along roads, heading away from where it set off', () => {
    expect(pathFrom(board, tileId(1), 2)).toEqual([1, 2, 3])
  })

  it('stops at a dead end instead of doubling back', () => {
    expect(pathFrom(board, tileId(0), 5)).toEqual([0, 1, 2, 3])
  })
})
