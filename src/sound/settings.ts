// The site's sound settings, kept for this browser: one mute for all sound, and a volume each for
// the music and the sound effects, so a player can keep one quiet under the other.

/**
 * The volumes (0–1) until a player moves a slider. The music is only a background to the board's
 * sounds (0.35 plays at 0.12, see `getMusicGain`).
 */
export const DEFAULT_MUSIC_VOLUME = 0.35
export const DEFAULT_EFFECTS_VOLUME = 0.4

const MUTE_KEY = 'tweetea.muted'
const MUSIC_KEY = 'tweetea.music'
const EFFECTS_KEY = 'tweetea.effects'
/**
 * Before music and effects had a slider each, one volume served both. It carries over to the
 * effects only: chosen for a jingle, it would be far too loud for music that plays all the time.
 */
const SHARED_KEY = 'tweetea.volume'

function read(key: string): number | null {
  try {
    const saved = localStorage.getItem(key)
    const value = saved === null ? NaN : Number(saved)
    return Number.isFinite(value) ? clamp(value) : null
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Kept for this visit only.
  }
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

let musicVolume = read(MUSIC_KEY) ?? DEFAULT_MUSIC_VOLUME
let effectsVolume = read(EFFECTS_KEY) ?? read(SHARED_KEY) ?? DEFAULT_EFFECTS_VOLUME
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
})()

export const getMusicVolume = () => musicVolume
/**
 * How loud the music plays for the slider's volume. Ears hear loudness on a log scale, so the
 * square spreads the quiet end over the slider: on a straight line, everything under 10% sounds
 * the same.
 */
export const getMusicGain = () => musicVolume ** 2
export const getEffectsVolume = () => effectsVolume
export const isMuted = () => muted

export function setMusicVolume(to: number) {
  musicVolume = clamp(to)
  write(MUSIC_KEY, String(musicVolume))
}

export function setEffectsVolume(to: number) {
  effectsVolume = clamp(to)
  write(EFFECTS_KEY, String(effectsVolume))
}

export function setMuted(to: boolean) {
  muted = to
  write(MUTE_KEY, to ? '1' : '0')
}
