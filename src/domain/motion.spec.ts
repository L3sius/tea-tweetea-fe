import { describe, expect, it } from 'vitest'
import type { GameEvent, JournalEntry } from './events'
import { teamId, tileId } from './ids'
import { Choreography, STEP_MS, TELEPORT_MS } from './motion'

const red = teamId(0)
const T0 = Date.parse('2026-10-06T12:00:00Z')

const entry = (seq: number, at: number, events: GameEvent[]): JournalEntry => ({
  seq,
  at: new Date(at),
  events,
})

const walk = (seq: number, at: number, path: number[]) =>
  entry(seq, at, [
    { kind: 'move_confirmed', teamId: red, path: path.map(tileId) },
    ...path
      .slice(1)
      .map((tile): GameEvent => ({ kind: 'stepped', teamId: red, tileId: tileId(tile) })),
  ])

describe('Choreography', () => {
  it('walks one step per STEP_MS from the entry time', () => {
    const c = new Choreography()
    c.apply(walk(1, T0, [10, 11, 12]))
    expect(c.placement(red, T0)).toEqual({ kind: 'walk', from: 10, to: 11, progress: 0 })
    expect(c.placement(red, T0 + STEP_MS * 1.5)).toEqual({
      kind: 'walk',
      from: 11,
      to: 12,
      progress: 0.5,
    })
    expect(c.placement(red, T0 + STEP_MS * 2)).toBeNull()
  })

  it('resumes mid-walk when the page loads late', () => {
    const c = new Choreography()
    c.apply(walk(1, T0, [10, 11, 12, 13]))
    // A page opened 1.2 steps into the walk still shows the piece on its way.
    expect(c.placement(red, T0 + STEP_MS * 1.2)).toMatchObject({ from: 11, to: 12 })
  })

  it('queues an entry behind a walk still playing', () => {
    const c = new Choreography()
    c.apply(walk(1, T0, [10, 11, 12]))
    c.apply(
      entry(2, T0 + 10, [{ kind: 'teleported', teamId: red, from: tileId(12), to: tileId(99) }]),
    )
    const walkEnds = T0 + STEP_MS * 2
    expect(c.placement(red, walkEnds - 1)).toMatchObject({ kind: 'walk', to: 12 })
    expect(c.placement(red, walkEnds + TELEPORT_MS / 2)).toMatchObject({
      kind: 'teleport',
      from: 12,
      to: 99,
    })
    expect(c.settlesAt(red)).toBe(walkEnds + TELEPORT_MS)
  })

  it('raises callouts when the piece gets there', () => {
    const c = new Choreography()
    c.apply(walk(1, T0, [10, 11]))
    c.apply(entry(2, T0, [{ kind: 'gem_collected', teamId: red, gem: 'blue', tileId: tileId(11) }]))
    expect(c.activeCues(T0)).toHaveLength(0)
    expect(c.activeCues(T0 + STEP_MS)).toEqual([
      expect.objectContaining({ text: 'Blue gem!', tone: 'gem' }),
    ])
  })

  it('ignores entries it has already seen', () => {
    const c = new Choreography()
    c.apply(walk(5, T0, [10, 11]))
    c.apply(walk(5, T0, [10, 11]))
    expect(c.settlesAt(red)).toBe(T0 + STEP_MS)
  })
})
