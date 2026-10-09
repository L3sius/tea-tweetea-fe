// The site's sound settings (volume and mute, for this browser) and its music: OSRS tracks served
// with the other OSRS assets. Browsers only start sound after a click, so `play` must run from one.
import { readConfig } from '@/config/env'

/** The music's volume (0–1) until a player moves the slider. */
export const DEFAULT_VOLUME = 0.4
const FADE_MS = 1500
const MUTE_KEY = 'tweetea.muted'
const VOLUME_KEY = 'tweetea.volume'

export const NEWBIE_MELODY = 'newbie-melody.ogg'

let audio: HTMLAudioElement | null = null
let fading = 0
let volume = readVolume()

function readVolume(): number {
  try {
    const saved = Number(localStorage.getItem(VOLUME_KEY) ?? NaN)
    return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : DEFAULT_VOLUME
  } catch {
    return DEFAULT_VOLUME
  }
}

export const getVolume = () => volume

/** Sets the volume (0–1) at once, and remembers it for this browser. */
export function setVolume(to: number) {
  volume = Math.min(1, Math.max(0, to))
  if (audio && !audio.paused) {
    cancelAnimationFrame(fading)
    audio.volume = volume
  }
  try {
    localStorage.setItem(VOLUME_KEY, String(volume))
  } catch {
    // Kept for this visit only.
  }
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setMuted(muted: boolean) {
  if (audio) audio.muted = muted
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // Remembered for this visit only.
  }
}

/** Fades `audio`'s volume to `to`, then runs `done`. */
function fade(to: number, done?: () => void) {
  cancelAnimationFrame(fading)
  const track = audio
  if (!track) return
  const from = track.volume
  const start = performance.now()
  const step = (now: number) => {
    // A frame's timestamp can come a moment before `start`, and volume refuses anything outside 0–1.
    const t = Math.min(1, Math.max(0, (now - start) / FADE_MS))
    track.volume = Math.min(1, Math.max(0, from + (to - from) * t))
    if (t < 1) fading = requestAnimationFrame(step)
    else done?.()
  }
  fading = requestAnimationFrame(step)
}

/** Whether a track is playing (a start the browser refused isn't). */
export function isPlaying(): boolean {
  return audio !== null && !audio.paused
}

/** Starts a track, looping, faded in. */
export function play(track: string) {
  stop(true)
  audio = new Audio(`${readConfig().osrsAssetsUrl}audio/${track}`)
  audio.loop = true
  audio.volume = 0
  audio.muted = isMuted()
  // A refused start (no click yet, or no file) just leaves the tutorial silent.
  audio.play().then(
    () => fade(volume),
    () => {},
  )
}

/** Fades the music out, or cuts it at once. */
export function stop(now = false) {
  const track = audio
  if (!track) return
  audio = null
  if (now) {
    cancelAnimationFrame(fading)
    track.pause()
    return
  }
  audio = track
  fade(0, () => {
    track.pause()
    if (audio === track) audio = null
  })
}
