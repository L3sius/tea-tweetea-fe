// `v-tutorial="'panel'"` names a part of the page for the tutorial: hidden while the tutorial runs,
// until the script reveals it (see RevealName in script.ts), when it fades in.
import { watchEffect, type Directive } from 'vue'
import { useTutorialStore } from '@/stores/tutorial'
import type { RevealName } from './script'

const stops = new WeakMap<HTMLElement, () => void>()

export const vTutorial: Directive<HTMLElement, RevealName> = {
  mounted(el, binding) {
    const tutorial = useTutorialStore()
    el.dataset.tutorial = binding.value
    let hidden = !tutorial.shows(binding.value)
    const stop = watchEffect(() => {
      const hide = !tutorial.shows(binding.value)
      el.classList.toggle('tutorial-hidden', hide)
      // Revealed during the tour: it fades in.
      if (hidden && !hide && tutorial.staged) {
        el.classList.add('tutorial-reveal')
        el.addEventListener('animationend', () => el.classList.remove('tutorial-reveal'), {
          once: true,
        })
      }
      hidden = hide
    })
    stops.set(el, stop)
  },
  unmounted(el) {
    stops.get(el)?.()
    stops.delete(el)
  },
}
