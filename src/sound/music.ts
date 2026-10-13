// The site's music: OSRS tracks served with the other OSRS assets, either a single track looping
// (the tour's) or a shuffled playlist (the game's). Browsers only start sound after a click, so a
// start must come after one. A track that stops fades out on its own, so the next one crossfades.
import { readConfig } from '@/config/env'
import { shuffle } from './playlist'
import { getMusicGain, isMuted } from './settings'

const FADE_MS = 1500
/** How far the music dips under Earl Grey's voice, and how fast. */
const DUCK_GAIN = 0.45
const DUCK_MS = 300
/** The last playlist track this browser played, so the next visit starts with another. */
const LAST_TRACK_KEY = 'tweetea.lastTrack'

/** The track playing, or paused to carry on. */
let audio: HTMLAudioElement | null = null
/** The playlist `audio` belongs to, in playing order; null for a track looping on its own. */
let list: { tracks: readonly string[]; order: string[]; at: number; failures: number } | null = null
/** The fade each track is in, by its animation frame. */
const fading = new Map<HTMLAudioElement, number>()
/** A playlist fading out to pause, which a change of volume mustn't undo. */
let pausing = false
/** Dipped under the voice (see voice.ts). */
let ducked = false

/** The volume the music plays at now. */
const gain = () => getMusicGain() * (ducked ? DUCK_GAIN : 1)

function cancelFade(track: HTMLAudioElement) {
  cancelAnimationFrame(fading.get(track) ?? 0)
  fading.delete(track)
}

/** Fades `track`'s volume to `to`, then runs `done`. */
function fade(track: HTMLAudioElement, to: number, done?: () => void, ms = FADE_MS) {
  cancelFade(track)
  const from = track.volume
  const start = performance.now()
  const step = (now: number) => {
    // A frame's timestamp can come a moment before `start`, and volume refuses anything outside 0–1.
    const t = Math.min(1, Math.max(0, (now - start) / ms))
    track.volume = Math.min(1, Math.max(0, from + (to - from) * t))
    if (t < 1) fading.set(track, requestAnimationFrame(step))
    else {
      fading.delete(track)
      done?.()
    }
  }
  fading.set(track, requestAnimationFrame(step))
}

/** Plays `track` (from silence, or on from where it paused) and fades it in. */
function fadeIn(track: HTMLAudioElement) {
  pausing = false
  // A refused start (no click yet, or no file) just leaves the page silent.
  track.play().then(
    () => {
      if (audio === track) fade(track, gain())
    },
    () => {},
  )
}

function lastTrack(): string | undefined {
  try {
    return localStorage.getItem(LAST_TRACK_KEY) ?? undefined
  } catch {
    return undefined
  }
}

function start(track: string) {
  const next = new Audio(`${readConfig().osrsAssetsUrl}audio/${track}`)
  next.loop = !list
  next.volume = 0
  next.muted = isMuted()
  if (list) {
    try {
      localStorage.setItem(LAST_TRACK_KEY, track)
    } catch {
      // The next visit may start with this track again.
    }
    next.addEventListener('ended', () => advance(next, false))
    next.addEventListener('error', () => advance(next, true))
  }
  audio = next
  fadeIn(next)
}

/** Moves the playlist on to its next track, reshuffled at the end of the list. */
function advance(from: HTMLAudioElement, failed: boolean) {
  if (audio !== from || !list) return
  list.failures = failed ? list.failures + 1 : 0
  // A list none of whose tracks loads would otherwise go round forever.
  if (list.failures >= list.tracks.length) return stop(true)
  list.at++
  if (list.at >= list.order.length) {
    list.order = shuffle(list.tracks, list.order[list.order.length - 1])
    list.at = 0
  }
  const next = list.order[list.at]
  if (next) start(next)
}

/** Brings the music playing now to the site's volume and mute, after the player changes them. */
export function followSettings() {
  // Tracks fading out go quiet with the rest when muted.
  for (const track of fading.keys()) track.muted = isMuted()
  if (!audio) return
  audio.muted = isMuted()
  if (!audio.paused && !pausing) {
    cancelFade(audio)
    audio.volume = gain()
  }
}

/** Dips the music under the voice, or brings it back up. */
export function duck(on: boolean) {
  if (ducked === on) return
  ducked = on
  if (audio && !audio.paused && !pausing) fade(audio, gain(), undefined, DUCK_MS)
}

/** Whether a track is playing (a start the browser refused isn't). */
export function isPlaying(): boolean {
  return audio !== null && !audio.paused
}

/** Starts a track, looping, faded in. */
export function play(track: string) {
  stop()
  start(track)
}

/** Plays `tracks` shuffled, one after another, or carries on where the same list paused. */
export function playList(tracks: readonly string[]) {
  if (audio && list?.tracks === tracks) return fadeIn(audio)
  stop()
  list = { tracks, order: shuffle(tracks, lastTrack()), at: 0, failures: 0 }
  const [first] = list.order
  if (first) start(first)
}

/**
 * Fades a playlist out and pauses it, for `playList` to carry on from there. A track looping on
 * its own (the tour's) plays on.
 */
export function pauseList() {
  const track = audio
  if (!track || !list || track.paused) return
  pausing = true
  fade(track, 0, () => track.pause())
}

/** Fades the music out, or cuts it at once. */
export function stop(now = false) {
  const track = audio
  if (!track) return
  audio = null
  list = null
  pausing = false
  if (now) {
    cancelFade(track)
    track.pause()
  } else {
    fade(track, 0, () => track.pause())
  }
}
