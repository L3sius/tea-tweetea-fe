<script setup lang="ts">
import type { Alert } from '@/stores/game'

defineProps<{ alerts: readonly Alert[] }>()
const emit = defineEmits<{ dismiss: [id: string] }>()

const ICONS = { minigame: '🎲', match: '⚔️', gem: '💎', end: '🏆' } as const
const TONES = {
  minigame: 'border-amber-400/70 bg-amber-950/90',
  match: 'border-red-400/70 bg-red-950/90',
  gem: 'border-fuchsia-400/70 bg-fuchsia-950/90',
  end: 'border-emerald-400/70 bg-emerald-950/90',
} as const
</script>

<template>
  <TransitionGroup
    tag="ol"
    class="pointer-events-none flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-2"
    aria-live="polite"
    enter-from-class="opacity-0 -translate-y-3 scale-95"
    leave-to-class="opacity-0 translate-x-6"
    enter-active-class="transition duration-300"
    leave-active-class="transition duration-300"
  >
    <li
      v-for="alert in alerts"
      :key="alert.id"
      class="pointer-events-auto flex items-start gap-3 rounded-xl border-2 px-4 py-3 shadow-2xl backdrop-blur"
      :class="TONES[alert.tone]"
    >
      <span class="text-2xl leading-none" aria-hidden="true">{{ ICONS[alert.tone] }}</span>
      <div class="min-w-0 flex-1">
        <p class="font-bold text-slate-50">{{ alert.title }}</p>
        <p class="text-sm text-slate-300">{{ alert.text }}</p>
      </div>
      <button
        type="button"
        class="text-slate-400 hover:text-slate-100"
        aria-label="Dismiss"
        @click="emit('dismiss', alert.id)"
      >
        ✕
      </button>
    </li>
  </TransitionGroup>
</template>
