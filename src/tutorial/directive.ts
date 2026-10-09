// `v-tutorial="'panel'"` names a part of the page for the tutorial: hidden while the tutorial runs,
// until the script reveals it (see RevealName in script.ts).
import { watchEffect, type Directive } from 'vue'
import { useTutorialStore } from '@/stores/tutorial'
import type { RevealName } from './script'

const stops = new WeakMap<HTMLElement, () => void>()

export const vTutorial: Directive<HTMLElement, RevealName> = {
  mounted(el, binding) {
    const tutorial = useTutorialStore()
    el.dataset.tutorial = binding.value
    const stop = watchEffect(() =>
      el.classList.toggle('tutorial-hidden', !tutorial.shows(binding.value)),
    )
    stops.set(el, stop)
  },
  unmounted(el) {
    stops.get(el)?.()
    stops.delete(el)
  },
}
