import { describe, expect, it } from 'vitest'
import type { GameEvent, JournalEntry } from './events'
import { instanceId, teamId, tileId } from './ids'
import { Choreography, JOKER_HOLD_MS, STEP_MS, TELEPORT_MS } from './motion'

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
    expect(c.placement(red, T0)).toEqual({
      kind: 'walk',
      from: 10,
      to: 11,
      progress: 0,
      steps: 2,
      seq: 1,
    })
    expect(c.placement(red, T0 + STEP_MS * 1.5)).toEqual({
      kind: 'walk',
      from: 11,
      to: 12,
      progress: 0.5,
      steps: 2,
      seq: 1,
    })
    expect(c.placement(red, T0 + STEP_MS * 2)).toBeNull()
  })

  it('tells every step how long its whole walk is', () => {
    const c = new Choreography()
    c.apply(walk(1, T0, [10, 11, 12, 13, 14, 15, 16, 17, 18]))
    expect(c.placement(red, T0 + STEP_MS * 5.5)).toMatchObject({ kind: 'walk', steps: 8 })
  })

  it('starts reactions after the movement that comes first', () => {
    const c = new Choreography()
    const blue = teamId(1)
    c.apply(walk(1, T0, [10, 11, 12]))
    c.apply(
      entry(2, T0, [
        { kind: 'tile_completed', teamId: red, tileId: tileId(12), by: null },
        { kind: 'card_drawn', teamId: blue, card: { kind: 'joker' }, steps: 1 },
        {
          kind: 'card_drawn',
          teamId: blue,
          card: { kind: 'suited', rank: 5, suit: 'clubs' },
          steps: 5,
        },
      ]),
    )
    const walkEnds = T0 + STEP_MS * 2
    expect(c.reactionsOf(red, walkEnds - 1)).toEqual([])
    expect(c.reactionsOf(red, walkEnds)).toMatchObject([{ kind: 'celebrate', at: walkEnds }])
    // Only a Joker is worth sulking about.
    expect(c.reactionsOf(blue, T0).map((r) => r.kind)).toEqual(['despair'])
  })

  it('lets the piece sulk at a Joker before the Joker teleports it', () => {
    const c = new Choreography()
    c.know(red, tileId(10))
    c.apply(
      entry(1, T0, [
        { kind: 'card_drawn', teamId: red, card: { kind: 'joker' }, steps: 1 },
        {
          kind: 'joker_effect',
          teamId: red,
          effect: { kind: 'teleport' },
        },
        { kind: 'teleported', teamId: red, from: tileId(10), to: tileId(40) },
      ]),
    )
    expect(c.reactionsOf(red, T0)).toMatchObject([{ kind: 'despair', at: T0 }])
    expect(c.activeCues(T0).map((cue) => cue.tone)).toEqual(['card'])
    // The teleport waits for the sulk.
    expect(c.placement(red, T0 + JOKER_HOLD_MS - 1)).toMatchObject({ kind: 'still', tile: 10 })
    expect(c.placement(red, T0 + JOKER_HOLD_MS + 1)).toMatchObject({ kind: 'teleport', to: 40 })
  })

  it('lands a teleport when the piece arrives', () => {
    const c = new Choreography()
    c.know(red, tileId(10))
    c.apply(entry(1, T0, [{ kind: 'teleported', teamId: red, from: tileId(10), to: tileId(40) }]))
    expect(c.reactionsOf(red, T0 + TELEPORT_MS)).toMatchObject([
      { kind: 'arrive', at: T0 + TELEPORT_MS },
    ])
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

  it('says what a blocker did once, not that the team is frozen', () => {
    const c = new Choreography()
    const blue = teamId(1)
    const until = new Date(T0 + 3_600_000)
    const blocker = { item: 'banana' as const, owner: blue, until }
    c.apply(
      entry(1, T0, [
        { kind: 'blocker_triggered', teamId: red, tileId: tileId(11), blocker },
        { kind: 'landed', teamId: red, tileId: tileId(11), instanceId: instanceId(3) },
        { kind: 'frozen', teamId: red, until, by: 'banana' },
      ]),
    )
    expect(c.activeCues(T0).map((cue) => cue.text)).toEqual(['Slipped!'])
    expect(c.reactionsOf(red, T0)).toMatchObject([{ kind: 'struck', cause: 'banana' }])
  })

  it('names the spell that froze a team, even when something holds it longer', () => {
    const c = new Choreography()
    const blue = teamId(1)
    const until = new Date(T0 + 3_600_000)
    c.apply(
      entry(1, T0, [
        {
          kind: 'item_used',
          teamId: blue,
          item: 'entangle',
          target: { kind: 'team', teamId: red },
        },
        { kind: 'frozen', teamId: red, until, by: 'wilderness_web' },
      ]),
    )
    expect(
      c
        .activeCues(T0)
        .filter((cue) => cue.teamId === red)
        .map((cue) => cue.text),
    ).toEqual(['Entangled!'])
    expect(c.reactionsOf(red, T0)).toMatchObject([{ kind: 'struck', cause: 'entangle' }])
  })

  it('gets a team back up from what held it as it thaws', () => {
    const c = new Choreography()
    const until = new Date(T0 + 60_000)
    c.apply(entry(1, T0, [{ kind: 'frozen', teamId: red, until, by: 'banana' }]))
    c.apply(entry(2, T0 + 60_000, [{ kind: 'thawed', teamId: red }]))
    expect(c.reactionsOf(red, T0 + 60_000)[0]).toMatchObject({ kind: 'freed', cause: 'banana' })
  })

  it('shows a spell hit, and not the shield it leaves', () => {
    const c = new Choreography()
    const blue = teamId(1)
    const until = new Date(T0 + 3_600_000)
    c.apply(
      entry(1, T0, [
        {
          kind: 'item_used',
          teamId: blue,
          item: 'ice_barrage',
          target: { kind: 'team', teamId: red },
        },
        { kind: 'shielded', teamId: red, until },
        { kind: 'frozen', teamId: red, until, by: 'ice_barrage' },
      ]),
    )
    const onRed = c.activeCues(T0 + 2_000).filter((cue) => cue.teamId === red)
    expect(onRed.map((cue) => cue.text)).toEqual(['Frozen!'])
  })

  it('calls a freeze without an item stuck', () => {
    const c = new Choreography()
    c.apply(entry(1, T0, [{ kind: 'frozen', teamId: red, until: new Date(T0 + 60_000), by: null }]))
    expect(c.activeCues(T0).map((cue) => cue.text)).toEqual(['Stuck!'])
  })

  it('ignores entries it has already seen', () => {
    const c = new Choreography()
    c.apply(walk(5, T0, [10, 11]))
    c.apply(walk(5, T0, [10, 11]))
    expect(c.settlesAt(red)).toBe(T0 + STEP_MS)
  })
})
