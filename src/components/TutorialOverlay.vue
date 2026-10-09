<script setup lang="ts">
import { useTutorialStore } from '@/stores/tutorial'

// Black over the whole page while the tutorial changes scene under it: as a tour opens (from the
// page as it was to the tour's own scene), around changes that move the layout, and as it ends.

const tutorial = useTutorialStore()
</script>

<template>
  <div
    class="cover fixed inset-0 z-[3000] bg-black"
    :class="tutorial.cover === 'in' ? 'cover-in' : 'cover-out'"
    :style="{ '--in': `${tutorial.coverMs.in}ms`, '--out': `${tutorial.coverMs.out}ms` }"
    aria-hidden="true"
  />
</template>

<style scoped>
.cover-in {
  animation: cover-in var(--in) ease both;
}
.cover-out {
  animation: cover-out var(--out) ease both;
  /* What's underneath works while the black lifts. */
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
