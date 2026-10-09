// Music for the tutorial: OSRS tracks served with the other OSRS assets. Browsers only start sound
// after a click, so `play` must run from one.
import { readConfig } from '@/config/env'

const VOLUME = 0.4
const FADE_MS = 1500
const MUTE_KEY = 'tweetea.muted'

export const NEWBIE_MELODY = 'newbie-melody.ogg'

let audio: HTMLAudioElement | null = null
let fading = 0

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
    const t = Math.min(1, (now - start) / FADE_MS)
    track.volume = from + (to - from) * t
    if (t < 1) fading = requestAnimationFrame(step)
    else done?.()
  }
  fading = requestAnimationFrame(step)
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
    () => fade(VOLUME),
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
