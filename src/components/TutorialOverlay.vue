<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import CharacterPreview from '@/components/CharacterPreview.vue'
import { HEADING } from '@/characters/heading'
import { TO_BLACK_MS, useTutorialStore } from '@/stores/tutorial'
import { GUIDE } from '@/tutorial/guide'
import { GESTURE } from '@/tutorial/script'
import { TtButton, TtText } from '@/ui/tt'

// The tutorial's title card, over the whole page: the page fades to black, then the card fades in.
// The tour itself plays inside the map's frame (TutorialStage).

const tutorial = useTutorialStore()

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') tutorial.finish()
  else if (e.key === 'Enter') tutorial.begin()
})
</script>

<template>
  <div class="tutorial fixed inset-0 z-[3000] select-none">
    <!-- Title card -->
    <!-- The page fades to black, then the title card fades in from it. -->
    <div class="title-cover size-full bg-black" :style="{ '--to-black': `${TO_BLACK_MS}ms` }">
      <div
        class="title-card flex size-full flex-col items-center justify-center gap-4 px-4 text-center"
      >
        <CharacterPreview
          :npc="GUIDE.npc"
          :anim="GESTURE.wave"
          :heading="HEADING.south"
          :width="60"
          :height="80"
          :scale="2"
        />
        <TtText as="h2" :size="4" font="quill" color="orange" glow>How to play</TtText>
        <TtText :size="1" color="white">
          A short tour of the board with {{ GUIDE.name }}. About two minutes, with sound.
        </TtText>
        <div class="flex items-center gap-4">
          <TtButton @click="tutorial.begin()">Begin</TtButton>
          <button type="button" class="tt-link tt-1" @click="tutorial.finish()">
            Skip the tour
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.title-cover {
  animation: fade-in var(--to-black) ease both;
}
.title-card {
  animation: fade-in 0.9s ease var(--to-black) both;
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
}
</style>
