// Plays the game's sound effects (public/sounds/, levelled to one loudness) at the site's volume.
// A sound that fails to load or play (no click on the page yet, or a missing file) stays silent.
import { useIntervalFn } from '@vueuse/core'
import type { SoundCue } from '@/domain/motion'
import type { SoundName } from '@/domain/sounds'
import { getVolume, isMuted } from './music'

/** How often the board looks for sounds whose moment has come. */
const TICK_MS = 100

/** One loaded copy of each sound; each play is a clone, so a sound can overlap itself. */
const loaded = new Map<SoundName, HTMLAudioElement>()
/** Sounds playing now, so a change of volume or mute reaches them mid-play (a jingle runs 9 s). */
const playing = new Set<HTMLAudioElement>()

export function playEffect(name: SoundName) {
  if (isMuted()) return
  let audio = loaded.get(name)
  if (!audio) {
    audio = new Audio(`${import.meta.env.BASE_URL}sounds/${name}.ogg`)
    audio.preload = 'auto'
    loaded.set(name, audio)
  }
  const copy = audio.cloneNode() as HTMLAudioElement
  copy.volume = getVolume()
  const done = () => playing.delete(copy)
  copy.addEventListener('ended', done, { once: true })
  copy.addEventListener('error', done, { once: true })
  playing.add(copy)
  copy.play().catch(done)
}

/** Brings the sounds playing now to the site's volume and mute, after the player changes them. */
export function followSettings() {
  for (const audio of playing) {
    audio.volume = getVolume()
    audio.muted = isMuted()
  }
}

/** Where scheduled sounds come from: the live board, and a replay while one plays. */
type SoundSource = { soundsBetween(from: number, to: number): SoundCue[] }

/**
 * Plays scheduled sounds as their moment comes, in server time. `hears` picks the ones this viewer
 * should hear. While the tab is hidden, or `quiet` says so (the tour shows a game of its own),
 * time moves on without them, so nothing piles up for later.
 */
export function useSoundEffects(options: {
  sources: () => readonly (SoundSource | null | undefined)[]
  hears: (cue: SoundCue) => boolean
  serverNow: () => number
  quiet?: () => boolean
}) {
  let last = options.serverNow()
  useIntervalFn(() => {
    const now = options.serverNow()
    if (!document.hidden && !options.quiet?.()) {
      for (const source of options.sources()) {
        for (const cue of source?.soundsBetween(last, now) ?? []) {
          if (options.hears(cue)) playEffect(cue.sound)
        }
      }
    }
    last = now
  }, TICK_MS)
}
