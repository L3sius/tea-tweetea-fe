// The music under the game: the playlist plays once the player has clicked on the page (browsers
// only start sound after one), and pauses while it can't be heard or `quiet` says so (the tour
// plays its own track).
import { useDocumentVisibility, useEventListener } from '@vueuse/core'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useSoundStore } from '@/stores/sound'
import * as music from './music'
import { GAME_TRACKS } from './playlist'

export function useGameMusic(options: { quiet: () => boolean }) {
  const sound = useSoundStore()
  const visibility = useDocumentVisibility()
  const clicked = ref(false)
  // Capturing, so a click a control keeps to itself still counts.
  useEventListener(window, ['click', 'keydown'], () => (clicked.value = true), { capture: true })

  // Muted or at zero, the music doesn't download or play at all.
  const wanted = computed(
    () =>
      clicked.value &&
      !options.quiet() &&
      visibility.value === 'visible' &&
      !sound.muted &&
      sound.musicVolume > 0,
  )
  watch(wanted, (on) => (on ? music.playList(GAME_TRACKS) : music.pauseList()), {
    immediate: true,
  })
  onScopeDispose(() => music.pauseList())
}
