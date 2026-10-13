import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as effects from '@/sound/effects'
import * as music from '@/sound/music'
import * as settings from '@/sound/settings'
import * as voice from '@/sound/voice'

/**
 * The site's sound settings: muted or not, and a volume each for the music and the sound effects
 * (Earl Grey's voice in the tour goes with the effects), kept for this browser. They apply wherever the control shows (the header, or the tour while it
 * hides it), sounds already playing included.
 */
export const useSoundStore = defineStore('sound', () => {
  const muted = ref(settings.isMuted())
  const musicVolume = ref(settings.getMusicVolume())
  const effectsVolume = ref(settings.getEffectsVolume())

  function follow() {
    music.followSettings()
    effects.followSettings()
    voice.followSettings()
  }

  function toggleMute() {
    muted.value = !muted.value
    settings.setMuted(muted.value)
    follow()
  }

  /** Sets the music's volume (0–1); moving it up unmutes. */
  function setMusicVolume(to: number) {
    settings.setMusicVolume(to)
    musicVolume.value = settings.getMusicVolume()
    follow()
    if (muted.value && to > 0) toggleMute()
  }

  /** Sets the sound effects' volume (0–1); moving it up unmutes. */
  function setEffectsVolume(to: number) {
    settings.setEffectsVolume(to)
    effectsVolume.value = settings.getEffectsVolume()
    follow()
    if (muted.value && to > 0) toggleMute()
  }

  return { muted, musicVolume, effectsVolume, toggleMute, setMusicVolume, setEffectsVolume }
})
