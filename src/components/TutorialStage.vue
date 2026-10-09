<script setup lang="ts">
import { useEventListener, useRafFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import CharacterPreview from '@/components/CharacterPreview.vue'
import { HEADING } from '@/characters/heading'
import { useTutorialStore } from '@/stores/tutorial'
import { GUIDE } from '@/tutorial/guide'
import { TtButton, TtText } from '@/ui/tt'

// The tutorial's scene, inside the map's frame: first the title over Earl Grey waving on the dark
// map, then (on Begin, which fades the title out and the chatbox in) the tour in his chatbox, as in
// an OSRS cutscene. A click on the map (or Space, Enter, →) finishes the line being typed, then
// moves on; ← goes back and Esc skips.

const tutorial = useTutorialStore()
const playing = computed(() => tutorial.phase === 'playing')

/** Letters typed per second, as the chatbox spells his lines out. */
const TYPE_RATE = 45

const typed = ref(0)
let typingFrom = performance.now()
const typing = computed(() => typed.value < tutorial.text.length)
const shownText = computed(() => tutorial.text.slice(0, typed.value))

watch(
  () => tutorial.text,
  () => {
    typed.value = 0
    typingFrom = performance.now()
  },
  { immediate: true },
)
useRafFn(() => {
  if (!typing.value) return
  const letters = Math.floor(((performance.now() - typingFrom) / 1000) * TYPE_RATE)
  typed.value = Math.min(tutorial.text.length, letters)
})

function advance() {
  if (!playing.value) return
  if (typing.value) typed.value = tutorial.text.length
  else tutorial.next()
}

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') return tutorial.finish()
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
    e.preventDefault()
    if (playing.value) advance()
    else tutorial.begin()
  } else if (e.key === 'ArrowLeft') tutorial.back()
})
</script>

<template>
  <div class="absolute inset-0 z-[1100] select-none">
    <div v-if="playing" class="absolute inset-0" @click="advance" />

    <!-- The title, above and below Earl Grey, who waves in the middle of the dark map. -->
    <Transition name="fade-slow">
      <div v-if="!playing" class="pointer-events-none absolute inset-0 text-center">
        <div class="absolute inset-x-4 top-[14%] flex flex-col items-center gap-2">
          <TtText as="h2" :size="4" font="quill" color="orange" glow>How to play</TtText>
          <TtText :size="1" color="white">A short tour of the board with {{ GUIDE.name }}.</TtText>
        </div>
        <div
          class="pointer-events-auto absolute inset-x-4 bottom-[16%] flex items-center justify-center gap-4"
        >
          <TtButton @click="tutorial.begin()">Begin</TtButton>
          <button type="button" class="tt-link tt-1" @click="tutorial.finish()">
            Skip the tour
          </button>
        </div>
      </div>
    </Transition>

    <div class="absolute top-3 right-3 flex items-center gap-1.5">
      <TtButton
        size="sm"
        :aria-pressed="tutorial.muted"
        :title="tutorial.muted ? 'Unmute the music' : 'Mute the music'"
        @click="tutorial.toggleMute()"
      >
        {{ tutorial.muted ? '♪ Off' : '♪ On' }}
      </TtButton>
      <TtButton size="sm" @click="tutorial.finish()">Skip</TtButton>
    </div>

    <Transition name="fade-slow">
      <section
        v-if="playing"
        class="tt-frame-iron chatbox absolute bottom-3 left-1/2 flex w-[min(760px,calc(100%-1.5rem))] -translate-x-1/2 items-stretch gap-3 p-2"
        role="dialog"
        :aria-label="`${GUIDE.name} says`"
        @click="advance"
      >
        <div class="chathead shrink-0" aria-hidden="true">
          <CharacterPreview
            :npc="GUIDE.npc"
            :anim="GUIDE.idle"
            :heading="HEADING.south"
            :width="44"
            :height="56"
            :scale="3"
          />
        </div>
        <div class="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
          <TtText :size="1" font="bold" color="orange">{{ GUIDE.name }}</TtText>
          <p class="tt-1 min-h-[3lh] text-white" aria-live="polite">{{ shownText }}</p>
          <div class="relative mt-auto flex w-full items-center justify-center">
            <button
              v-if="!tutorial.isFirst"
              type="button"
              class="tt-link tt-1 absolute left-0"
              @click.stop="tutorial.back()"
            >
              ← Back
            </button>
            <TtText :size="1" color="cyan" :class="{ invisible: typing }">
              {{ tutorial.isLast ? 'Click to finish' : 'Click to continue' }}
            </TtText>
          </div>
        </div>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.chatbox {
  cursor: pointer;
}
/* Begin: the title fades out as the chatbox (and, on the map, the board) fade in. */
.fade-slow-enter-active,
.fade-slow-leave-active {
  transition: opacity 1.2s ease;
}
.fade-slow-enter-from,
.fade-slow-leave-to {
  opacity: 0;
}
/* Head and shoulders, like an OSRS chathead: the top of a 3× preview, nudged down in its box. */
.chathead {
  width: 112px;
  height: 104px;
  overflow: hidden;
}
.chathead > :deep(canvas) {
  margin: 12px 0 0 -10px;
}
</style>
