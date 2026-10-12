import { describe, expect, it } from 'vitest'
import { GAME_TRACKS, NEWBIE_MELODY, shuffle } from './playlist'

/** A stand-in for Math.random that returns `values` in turn. */
const sequence = (...values: number[]) => {
  let at = 0
  return () => values[at++ % values.length] ?? 0
}

describe('shuffle', () => {
  it('plays every track once', () => {
    const order = shuffle(GAME_TRACKS)
    expect(order).toHaveLength(GAME_TRACKS.length)
    expect(new Set(order)).toEqual(new Set(GAME_TRACKS))
  })

  it('leaves the list it was given alone', () => {
    const tracks = ['a', 'b', 'c']
    shuffle(tracks, undefined, sequence(0))
    expect(tracks).toEqual(['a', 'b', 'c'])
  })

  it("doesn't start with the track that just played", () => {
    // Always picking the first track left would keep the order, with 'a' first; it goes last.
    expect(shuffle(['a', 'b', 'c'], 'a', sequence(0))).toEqual(['b', 'c', 'a'])
  })

  it('plays a single track again, as there is no other', () => {
    expect(shuffle(['a'], 'a')).toEqual(['a'])
  })
})

describe('GAME_TRACKS', () => {
  it('lists each track once, and leaves the tour its own', () => {
    expect(new Set(GAME_TRACKS).size).toBe(GAME_TRACKS.length)
    expect(GAME_TRACKS).not.toContain(NEWBIE_MELODY)
  })
})
