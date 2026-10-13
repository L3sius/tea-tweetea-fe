// Earl Grey's voice in the tour: one clip per chatbox line (public/voice/, cut by tools/voice/).
// There is one voice at a time. A new line fades the last clip out at once, so clicking through
// the tour never stacks voices, and the music dips while he speaks.
import * as music from './music'
import { getEffectsVolume, isMuted } from './settings'

/** Long enough that a cut-off clip doesn't click, short enough to sound like a cut. */
const STOP_MS = 80

/** One loaded copy of each clip; each play is a clone, so a clip fading out can start again. */
const loaded = new Map<string, HTMLAudioElement>()
/** The clip speaking now. */
let speaking: HTMLAudioElement | null = null

const clipUrl = (id: string) => `${import.meta.env.BASE_URL}voice/tutorial/${id}.ogg`

function source(id: string): HTMLAudioElement {
  let audio = loaded.get(id)
  if (!audio) {
    audio = new Audio(clipUrl(id))
    audio.preload = 'auto'
    loaded.set(id, audio)
  }
  return audio
}

/** Starts loading a clip, so it plays without a gap when its line comes. */
export function preload(id: string) {
  source(id)
}

/** Says clip `id`, cutting off whatever he was saying; false when the sound is off. */
export function speak(id: string): boolean {
  silence()
  if (isMuted() || getEffectsVolume() === 0) return false
  const clip = source(id).cloneNode() as HTMLAudioElement
  clip.volume = getEffectsVolume()
  const done = () => {
    if (speaking !== clip) return
    speaking = null
    music.duck(false)
  }
  clip.addEventListener('ended', done, { once: true })
  clip.addEventListener('error', done, { once: true })
  speaking = clip
  music.duck(true)
  // A refused start (no click on the page yet) just leaves him silent.
  clip.play().catch(done)
  return true
}

/** Stops him mid-sentence, with a quick fade. */
export function silence() {
  const clip = speaking
  if (!clip) return
  speaking = null
  music.duck(false)
  const from = clip.volume
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, Math.max(0, (now - start) / STOP_MS))
    clip.volume = from * (1 - t)
    if (t < 1) requestAnimationFrame(step)
    else clip.pause()
  }
  requestAnimationFrame(step)
}

/** Brings the clip speaking now to the effects volume and the site's mute. */
export function followSettings() {
  if (!speaking) return
  speaking.volume = getEffectsVolume()
  speaking.muted = isMuted()
}
