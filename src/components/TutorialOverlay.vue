<script setup lang="ts">
import { FROM_BLACK_MS, TO_BLACK_MS, useTutorialStore } from '@/stores/tutorial'

// Black over the whole page as the tutorial opens: it fades in over the page as it was, and out
// again over the tutorial's own scene (TutorialStage), set up underneath while it was black.

const tutorial = useTutorialStore()
</script>

<template>
  <div
    class="cover fixed inset-0 z-[3000] bg-black"
    :class="tutorial.phase === 'fading' ? 'cover-in' : 'cover-out'"
    :style="{ '--in': `${TO_BLACK_MS}ms`, '--out': `${FROM_BLACK_MS}ms` }"
    aria-hidden="true"
  />
</template>

<style scoped>
.cover-in {
  animation: cover-in var(--in) ease both;
}
.cover-out {
  animation: cover-out var(--out) ease both;
  /* Begin works while the black lifts. */
  pointer-events: none;
}
@keyframes cover-in {
  from {
    opacity: 0;
  }
}
@keyframes cover-out {
  to {
    opacity: 0;
  }
}
</style>
