import { defineStore } from 'pinia'
import { ref } from 'vue'

const DONE_KEY = 'tweetea.dinkSetup'

/**
 * The Dink setup dialog. A first-time visitor is asked until they say they've set it up; after
 * that, the header's button opens it again, and then it closes like any other dialog.
 */
export const useDinkStore = defineStore('dink', () => {
  /** This browser has said it set Dink up. */
  const done = ref(readDone())
  /** Opened from the header, as opposed to the first-visit ask. */
  const shown = ref(false)

  function show() {
    shown.value = true
  }

  function hide() {
    shown.value = false
  }

  function confirm() {
    done.value = true
    shown.value = false
    try {
      localStorage.setItem(DONE_KEY, '1')
    } catch {
      // Asked again next visit.
    }
  }

  return { done, shown, show, hide, confirm }
})

function readDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === '1'
  } catch {
    return false
  }
}
