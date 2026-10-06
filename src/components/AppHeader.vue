<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
const { state, connection } = storeToRefs(game)

const CONNECTION = {
  connecting: { label: 'Connecting', dot: 'bg-slate-400' },
  live: { label: 'Live', dot: 'bg-emerald-400 animate-pulse' },
  reconnecting: { label: 'Reconnecting', dot: 'bg-amber-400 animate-pulse' },
  offline: { label: 'Not live', dot: 'bg-slate-500' },
} as const
const badge = computed(() => CONNECTION[connection.value])

const PHASES = { setup: 'Setting up', running: 'In progress', ended: 'Finished' } as const

const LINKS = [
  { to: '/', label: 'Board' },
  { to: '/stats', label: 'Stats' },
  { to: '/teams', label: 'Teams' },
] as const
</script>

<template>
  <header
    class="relative z-[1100] flex h-12 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-3 sm:px-4"
  >
    <RouterLink to="/" class="flex items-center gap-2">
      <span class="text-lg" aria-hidden="true">🐤</span>
      <h1 class="text-base font-bold tracking-tight whitespace-nowrap text-amber-200 sm:text-lg">
        Tweetea<span class="hidden sm:inline"> and the Magic Gems</span>
      </h1>
    </RouterLink>
    <nav class="flex gap-1 text-sm" aria-label="Pages">
      <RouterLink
        v-for="link in LINKS"
        :key="link.to"
        :to="link.to"
        class="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        active-class="!bg-slate-800 !text-amber-200"
      >
        {{ link.label }}
      </RouterLink>
    </nav>
    <span
      v-if="state"
      class="hidden rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300 md:inline"
    >
      {{ PHASES[state.phase] }}
    </span>
    <span class="ml-auto flex items-center gap-2 text-xs text-slate-400" role="status">
      <span class="size-2 rounded-full" :class="badge.dot" aria-hidden="true" />
      <span class="hidden sm:inline">{{ badge.label }}</span>
    </span>
  </header>
</template>
