import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as music from '@/tutorial/music'

/**
 * The site's sound settings: muted or not, and the volume, kept for this browser. They apply to
 * all sound on the site, wherever the control shows (the header, or the tour while it hides it).
 */
export const useSoundStore = defineStore('sound', () => {
  const muted = ref(music.isMuted())
  const volume = ref(music.getVolume())

  function toggleMute() {
    muted.value = !muted.value
    music.setMuted(muted.value)
  }

  /** Sets the volume (0–1); moving it up unmutes. */
  function setVolume(to: number) {
    music.setVolume(to)
    volume.value = music.getVolume()
    if (muted.value && to > 0) toggleMute()
  }

  return { muted, volume, toggleMute, setVolume }
})
