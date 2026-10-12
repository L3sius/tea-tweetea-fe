// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** The settings module as a fresh page load would read it. */
const load = () => import('./settings')

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

describe('sound settings', () => {
  it('start at the defaults, the music under the effects', async () => {
    const settings = await load()
    expect(settings.getMusicVolume()).toBe(settings.DEFAULT_MUSIC_VOLUME)
    expect(settings.getEffectsVolume()).toBe(settings.DEFAULT_EFFECTS_VOLUME)
    expect(settings.DEFAULT_MUSIC_VOLUME).toBeLessThan(settings.DEFAULT_EFFECTS_VOLUME)
    expect(settings.isMuted()).toBe(false)
  })

  it('keep a volume each, and the mute, for the next visit', async () => {
    const before = await load()
    before.setMusicVolume(0.3)
    before.setEffectsVolume(0.7)
    before.setMuted(true)
    vi.resetModules()
    const after = await load()
    expect(after.getMusicVolume()).toBe(0.3)
    expect(after.getEffectsVolume()).toBe(0.7)
    expect(after.isMuted()).toBe(true)
  })

  it('start the effects, not the music, from the one volume a player chose before the split', async () => {
    localStorage.setItem('tweetea.volume', '0.6')
    const settings = await load()
    expect(settings.getEffectsVolume()).toBe(0.6)
    expect(settings.getMusicVolume()).toBe(settings.DEFAULT_MUSIC_VOLUME)
  })

  it('play the music on a curve, so the quiet end of its slider is heard', async () => {
    const settings = await load()
    settings.setMusicVolume(1)
    expect(settings.getMusicGain()).toBe(1)
    settings.setMusicVolume(0.5)
    expect(settings.getMusicGain()).toBe(0.25)
    settings.setMusicVolume(0.1)
    expect(settings.getMusicGain()).toBeCloseTo(0.01)
  })

  it('keep volumes between 0 and 1, and ignore one that is not a number', async () => {
    localStorage.setItem('tweetea.effects', 'loud')
    const settings = await load()
    expect(settings.getEffectsVolume()).toBe(settings.DEFAULT_EFFECTS_VOLUME)
    settings.setMusicVolume(3)
    expect(settings.getMusicVolume()).toBe(1)
    settings.setEffectsVolume(-1)
    expect(settings.getEffectsVolume()).toBe(0)
  })
})
