import { describe, expect, it } from 'vitest'
import { MIN_STAY_MS, direct, moment, momentOf } from './director'
import type { GameEvent, JournalEntry } from './events'
import { teamId, tileId } from './ids'
import { Choreography, STEP_MS } from './motion'

const red = teamId(0)
const blue = teamId(1)
const T = Date.parse('2026-10-10T12:00:00Z')

describe('direct', () => {
  it('shows the most important moment playing now', () => {
    const tile = moment('1', red, 'tile', T)
    const walk = moment('2', blue, 'walking', T, T + 10_000)
    expect(direct(null, [tile, walk], T + 100)?.moment.id).toBe('2')
  })

  it('stays on a walk until it settles, however much else happens', () => {
    const walk = moment('1', red, 'walking', T, T + 10_000)
    const shot = direct(null, [walk], T)
    const other = moment('2', blue, 'teleporting', T + 5_000, T + 6_000)
    expect(direct(shot, [walk, other], T + 5_500)?.moment.id).toBe('1')
  })

  it('cuts a walk short for a big moment', () => {
    const walk = moment('1', red, 'walking', T, T + 10_000)
    const shot = direct(null, [walk], T)
    const gem = moment('2', blue, 'gem', T + 5_000)
    expect(direct(shot, [walk, gem], T + 5_500)?.moment.id).toBe('2')
  })

  it('stays a little while even when what it showed is over', () => {
    const item = moment('1', red, 'item', T, T + 500)
    const shot = direct(null, [item], T)
    const tile = moment('2', blue, 'tile', T + 1_000)
    expect(direct(shot, [item, tile], T + 1_500)?.moment.id).toBe('1')
    expect(direct(shot, [item, tile], T + MIN_STAY_MS + 1)?.moment.id).toBe('2')
  })

  it('stays on the last team, quiet, when nothing is happening', () => {
    const walk = moment('1', red, 'walking', T, T + 2_000)
    const shot = direct(null, [walk], T)
    const quiet = direct(shot, [walk], T + 10_000)
    expect(quiet?.quiet).toBe(true)
    expect(quiet?.moment.teamId).toBe(red)
    expect(direct(null, [], T)).toBeNull()
  })
})

describe('moments', () => {
  it('shows a spell where it lands', () => {
    const used: GameEvent = {
      kind: 'item_used',
      teamId: red,
      item: 'ice_barrage',
      target: { kind: 'team', teamId: blue },
    }
    expect(momentOf(used)).toEqual({ team: blue, kind: 'frozen' })
  })

  it('records a walk from its first step until the piece settles', () => {
    const c = new Choreography()
    const walk: JournalEntry = {
      seq: 1,
      at: new Date(T),
      events: [
        { kind: 'move_confirmed', teamId: red, path: [tileId(1), tileId(2), tileId(3)] },
        { kind: 'stepped', teamId: red, tileId: tileId(2) },
        { kind: 'stepped', teamId: red, tileId: tileId(3) },
        { kind: 'gem_collected', teamId: red, gem: 'blue', tileId: tileId(3) },
      ],
    }
    c.apply(walk)
    const moments = c.momentsAt(T)
    expect(moments.find((m) => m.kind === 'walking')).toMatchObject({
      teamId: red,
      at: T,
      until: T + STEP_MS * 2,
    })
    // The gem shows as the walk reaches it.
    expect(moments.find((m) => m.kind === 'gem')?.at).toBe(T + STEP_MS * 2)
  })
})
