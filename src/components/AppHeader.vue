<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { TtButton, TtText } from '@/ui/tt'

const game = useGameStore()
const { state, connection } = storeToRefs(game)
const wide = useMediaQuery('(min-width: 1024px)')

const CONNECTION = {
  connecting: { label: 'Connecting', color: 'var(--text-muted)' },
  live: { label: 'Live', color: 'var(--osrs-green)' },
  reconnecting: { label: 'Reconnecting', color: 'var(--osrs-orange)' },
  offline: { label: 'Not live', color: 'var(--osrs-red)' },
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
    class="tt-frame-iron relative z-[1100] flex shrink-0 flex-wrap items-center justify-center gap-x-6 gap-y-1.5 px-3 py-0.5"
  >
    <RouterLink to="/" class="whitespace-nowrap">
      <TtText as="h1" :size="wide ? 3 : 2" font="quill" color="orange" glow>
        Tweetea and the Magic Gems
      </TtText>
    </RouterLink>
    <nav class="flex flex-wrap justify-center gap-1.5" aria-label="Pages">
      <RouterLink
        v-for="link in LINKS"
        :key="link.to"
        v-slot="{ navigate, isActive }"
        :to="link.to"
        custom
      >
        <TtButton
          size="sm"
          :selected="isActive"
          :aria-current="isActive ? 'page' : undefined"
          @click="navigate"
        >
          {{ link.label }}
        </TtButton>
      </RouterLink>
    </nav>
    <div class="flex items-center gap-3 lg:ml-auto" role="status">
      <TtText v-if="state" :size="1" color="white">{{ PHASES[state.phase] }}</TtText>
      <span class="flex items-center gap-1.5">
        <span
          class="tt-swatch"
          :class="{ 'animate-pulse': connection === 'live' || connection === 'reconnecting' }"
          :style="{ background: badge.color }"
          aria-hidden="true"
        />
        <TtText :size="1" :color="badge.color">{{ badge.label }}</TtText>
      </span>
    </div>
  </header>
</template>
