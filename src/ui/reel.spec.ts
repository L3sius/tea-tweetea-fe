import { describe, expect, it } from 'vitest'
import { FAKE_PICKS, reelProgress, reelStrip } from './reel'

/** A fixed sequence instead of Math.random, so the strip is the same every run. */
const seeded = () => {
  let x = 0.37
  return () => (x = (x * 9301 + 0.49297) % 1)
}

describe('reelStrip', () => {
  it('stops on the winner, after the given number of fakes', () => {
    const strip = reelStrip('Sire 50', 20, FAKE_PICKS, seeded())
    expect(strip.labels[strip.winner]).toBe('Sire 50')
    expect(strip.start - strip.winner).toBe(20)
    // Picks either side of both ends, so the view never runs out.
    expect(strip.winner).toBeGreaterThan(0)
    expect(strip.labels.length - 1 - strip.start).toBeGreaterThan(0)
  })

  it('shows the winner only once and never the same pick twice in a row', () => {
    const strip = reelStrip(FAKE_PICKS[0] ?? '', 40, FAKE_PICKS, seeded())
    expect(strip.labels.filter((l) => l === FAKE_PICKS[0])).toHaveLength(1)
    for (let i = 1; i < strip.labels.length; i++)
      expect(strip.labels[i]).not.toBe(strip.labels[i - 1])
  })
})

describe('reelProgress', () => {
  it('runs from 0 to 1, fast first and slow at the end', () => {
    expect(reelProgress(0)).toBe(0)
    expect(reelProgress(1)).toBe(1)
    expect(reelProgress(2)).toBe(1)
    expect(reelProgress(0.25)).toBeGreaterThan(0.6)
    expect(reelProgress(0.9)).toBeGreaterThan(0.999)
  })
})
