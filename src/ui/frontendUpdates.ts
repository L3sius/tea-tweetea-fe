import { useIntervalFn } from '@vueuse/core'
import { ref } from 'vue'

const CHECK_MS = 5 * 60_000

/** The bundle this page runs: Vite gives each build's entry script a new hashed name. */
const entryScript = (doc: Document) =>
  doc.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src') ?? null

/**
 * Notices when a new frontend build is deployed, by fetching the page's HTML now and then and
 * comparing its entry script with the one running. Does nothing in development.
 */
export function useFrontendUpdates() {
  const available = ref(false)
  if (import.meta.env.DEV) return available
  const running = entryScript(document)
  useIntervalFn(async () => {
    try {
      const response = await fetch(window.location.origin + import.meta.env.BASE_URL, {
        cache: 'no-store',
      })
      const html = new DOMParser().parseFromString(await response.text(), 'text/html')
      const latest = entryScript(html)
      if (running && latest && latest !== running) available.value = true
    } catch {
      // Offline for a moment; try again next time.
    }
  }, CHECK_MS)
  return available
}
