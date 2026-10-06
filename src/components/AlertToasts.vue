<script setup lang="ts">
import type { Alert } from '@/stores/game'
import { TtText } from '@/ui/tt'

defineProps<{ alerts: readonly Alert[] }>()
const emit = defineEmits<{ dismiss: [id: string] }>()

const TITLE_COLOR = {
  minigame: 'var(--osrs-orange)',
  match: 'var(--osrs-red)',
  gem: 'var(--gem-purple-glow)',
  end: 'var(--osrs-green)',
} as const
</script>

<template>
  <TransitionGroup
    tag="ol"
    class="pointer-events-none flex w-[min(30rem,calc(100vw-2rem))] flex-col gap-1.5"
    aria-live="polite"
    enter-from-class="opacity-0 -translate-y-3"
    leave-to-class="opacity-0 translate-x-6"
    enter-active-class="transition duration-300 ease-[steps(4)]"
    leave-active-class="transition duration-300 ease-[steps(4)]"
  >
    <li
      v-for="alert in alerts"
      :key="alert.id"
      class="tt-sprite-display pointer-events-auto relative flex flex-col items-center gap-1 px-6 py-1"
    >
      <TtText :size="2" :color="TITLE_COLOR[alert.tone]" glow>{{ alert.title }}</TtText>
      <TtText :size="1" color="white">{{ alert.text }}</TtText>
      <button
        type="button"
        class="tt-link tt-1 absolute -top-2 -right-2"
        aria-label="Dismiss"
        @click="emit('dismiss', alert.id)"
      >
        x
      </button>
    </li>
  </TransitionGroup>
</template>
