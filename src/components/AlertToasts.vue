<script setup lang="ts">
import type { Alert } from '@/stores/game'
import { TtButton, TtText } from '@/ui/tt'

defineProps<{ alerts: readonly Alert[] }>()
const emit = defineEmits<{ dismiss: [id: string]; openEvents: [id: string] }>()

const TITLE_COLOR = {
  minigame: 'var(--osrs-orange)',
  match: 'var(--osrs-red)',
  gem: 'var(--gem-purple-glow)',
  end: 'var(--osrs-green)',
  item: 'var(--osrs-yellow)',
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
      <!-- A minigame alert stays until the viewer acts on it. -->
      <div v-if="alert.sticky" class="mt-1 flex flex-wrap justify-center gap-1.5">
        <TtButton size="sm" @click="emit('openEvents', alert.id)">Go to Events</TtButton>
        <TtButton size="sm" @click="emit('dismiss', alert.id)">Dismiss</TtButton>
      </div>
      <button
        v-else
        type="button"
        class="tt-link tt-1 absolute top-0 right-1.5"
        aria-label="Dismiss"
        @click="emit('dismiss', alert.id)"
      >
        x
      </button>
    </li>
  </TransitionGroup>
</template>
