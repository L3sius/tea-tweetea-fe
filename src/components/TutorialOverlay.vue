<script setup lang="ts">
import { useEventListener, useRafFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import CharacterPreview from '@/components/CharacterPreview.vue'
import { HEADING } from '@/characters/heading'
import { TO_BLACK_MS, useTutorialStore } from '@/stores/tutorial'
import { GUIDE } from '@/tutorial/guide'
import { GESTURE } from '@/tutorial/script'
import { TtButton, TtText } from '@/ui/tt'

// The tutorial over the page: a title card, then letterbox bars and Earl Grey's chatbox, as in an
// OSRS cutscene. A click anywhere (or Space, Enter, →) finishes the line being typed, then moves on.

const tutorial = useTutorialStore()

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
  if (tutorial.phase !== 'playing') return
  if (typing.value) typed.value = tutorial.text.length
  else tutorial.next()
}

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') return tutorial.finish()
  if (tutorial.phase === 'title' && e.key === 'Enter') return tutorial.begin()
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
    e.preventDefault()
    advance()
  } else if (e.key === 'ArrowLeft') tutorial.back()
})
</script>

<template>
  <div class="tutorial fixed inset-0 z-[3000] select-none">
    <!-- Title card -->
    <!-- The page fades to black, then the title card fades in from it. -->
    <div
      v-if="tutorial.phase === 'title'"
      class="title-cover size-full bg-black"
      :style="{ '--to-black': `${TO_BLACK_MS}ms` }"
    >
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

    <!-- The tour -->
    <template v-else>
      <div class="absolute inset-0" @click="advance" />
      <Transition appear name="letterbox-top">
        <div class="pointer-events-none absolute inset-x-0 top-0 h-[7dvh] bg-black" />
      </Transition>
      <Transition appear name="letterbox-bottom">
        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-[7dvh] bg-black" />
      </Transition>

      <div class="absolute top-2 right-2 flex items-center gap-1.5">
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

      <section
        class="tt-frame-iron chatbox absolute bottom-[3dvh] left-1/2 flex w-[min(760px,calc(100%-1rem))] -translate-x-1/2 items-stretch gap-3 p-2"
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
    </template>
  </div>
</template>

<style scoped>
.chatbox {
  cursor: pointer;
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
.letterbox-top-enter-active,
.letterbox-bottom-enter-active {
  transition: transform 1.2s ease;
}
.letterbox-top-enter-from {
  transform: translateY(-100%);
}
.letterbox-bottom-enter-from {
  transform: translateY(100%);
}
</style>
