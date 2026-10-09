import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { GameEvent, JournalEntry } from './events'
import { teamId, tileId } from './ids'
import { Choreography, STEP_MS } from './motion'
import { SOUNDS, entryContext, soundFor } from './sounds'

const red = teamId(0)
const blue = teamId(1)
const T0 = Date.parse('2026-10-06T12:00:00Z')
const entry = (seq: number, at: number, events: GameEvent[]): JournalEntry => ({
  seq,
  at: new Date(at),
  events,
})
const until = new Date(T0 + 3_600_000)

/** The sounds an entry makes, in order. */
const soundsOf = (events: GameEvent[]) => {
  const context = entryContext(entry(1, T0, events))
  return events.map((e) => soundFor(e, context)).filter((s) => s !== null)
}

describe('soundFor', () => {
  it('lets everyone hear big moments, and only the team its own small ones', () => {
    expect(
      soundsOf([{ kind: 'gem_collected', teamId: red, gem: 'blue', tileId: tileId(3) }]),
    ).toEqual([{ sound: 'level-up', team: red, audience: 'everyone' }])
    expect(soundsOf([{ kind: 'tile_completed', teamId: red, tileId: tileId(3) }])).toEqual([
      { sound: 'fanfare', team: red, audience: 'team' },
    ])
  })

  it('makes a Joker heard by everyone, other cards only by their team', () => {
    const joker = soundsOf([{ kind: 'card_drawn', teamId: red, card: { kind: 'joker' }, steps: 1 }])
    expect(joker).toEqual([{ sound: 'joker', team: red, audience: 'everyone' }])
    const four = soundsOf([
      {
        kind: 'card_drawn',
        teamId: red,
        card: { kind: 'suited', rank: 4, suit: 'clubs' },
        steps: 4,
      },
    ])
    expect(four).toEqual([{ sound: 'card-turn', team: red, audience: 'team' }])
  })

  it('casts a spell from the user and lands its hit on the target', () => {
    const sounds = soundsOf([
      {
        kind: 'item_used',
        teamId: red,
        item: 'ice_barrage',
        target: { kind: 'team', teamId: blue },
      },
      { kind: 'frozen', teamId: blue, until },
    ])
    expect(sounds).toEqual([
      { sound: 'ice-barrage-cast', team: red, audience: 'everyone' },
      { sound: 'ice-barrage-impact', team: blue, audience: 'everyone' },
    ])
  })

  it('plays only the blocker for a freeze a blocker caused', () => {
    const blocker = { item: 'wilderness_web', owner: blue, until } as const
    const sounds = soundsOf([
      { kind: 'blocker_triggered', teamId: red, tileId: tileId(4), blocker },
      { kind: 'frozen', teamId: red, until },
    ])
    expect(sounds.map((s) => s.sound)).toEqual(['web-stuck'])
  })

  it('does not play a teleport on top of the item that caused it', () => {
    const sounds = soundsOf([
      { kind: 'item_used', teamId: red, item: 'quetzal_whistle', target: null },
      { kind: 'teleported', teamId: red, from: tileId(1), to: tileId(9) },
    ])
    expect(sounds.map((s) => s.sound)).toEqual(['quetzal-whistle'])
    const joker = soundsOf([{ kind: 'teleported', teamId: red, from: tileId(1), to: tileId(9) }])
    expect(joker.map((s) => s.sound)).toEqual(['teleport'])
  })

  it('drops an item only when the team discards it', () => {
    const lost = (reason: string) =>
      soundsOf([{ kind: 'item_lost', teamId: red, item: 'banana', reason }]).map((s) => s.sound)
    expect(lost('discarded')).toEqual(['item-drop'])
    expect(lost('used')).toEqual([])
    expect(lost('blocked a freeze')).toEqual(['protect-from-magic'])
  })
})

describe('sounds on the board', () => {
  it('plays a gem as the walk reaches it, not when the entry arrives', () => {
    const c = new Choreography()
    c.apply(
      entry(1, T0, [
        { kind: 'move_confirmed', teamId: red, path: [tileId(1), tileId(2), tileId(3)] },
        { kind: 'stepped', teamId: red, tileId: tileId(2) },
        { kind: 'stepped', teamId: red, tileId: tileId(3) },
        { kind: 'gem_collected', teamId: red, gem: 'blue', tileId: tileId(3) },
      ]),
    )
    expect(c.soundsBetween(T0 - 1, T0 + STEP_MS * 2 - 1)).toEqual([])
    expect(c.soundsBetween(T0 - 1, T0 + STEP_MS * 2).map((s) => s.sound)).toEqual(['level-up'])
  })
})

describe('sound files', () => {
  it('has a file in public/sounds for every sound the game plays', () => {
    const folder = fileURLToPath(new URL('../../public/sounds/', import.meta.url))
    expect(SOUNDS.filter((name) => !existsSync(`${folder}${name}.ogg`))).toEqual([])
  })
})
