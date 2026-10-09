<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useTeamStore } from '@/stores/team'
import { useTutorialStore } from '@/stores/tutorial'
import { teamColor } from '@/ui/colors'
import { TtButton, TtText } from '@/ui/tt'
import SoundControl from './SoundControl.vue'

const game = useGameStore()
const { connection } = storeToRefs(game)
const my = useTeamStore()
const tutorial = useTutorialStore()
const router = useRouter()
// The big title only where the header still fits on one row beside it.
const wide = useMediaQuery('(min-width: 1600px)')

/** The tutorial plays on the board. */
async function howToPlay() {
  await router.push('/')
  tutorial.start()
}

const CONNECTION = {
  connecting: { label: 'Connecting', color: 'var(--text-muted)' },
  live: { label: 'Live', color: 'var(--osrs-green)' },
  reconnecting: { label: 'Reconnecting', color: 'var(--osrs-orange)' },
  offline: { label: 'Not live', color: 'var(--osrs-red)' },
} as const
const badge = computed(() => CONNECTION[connection.value])

const LINKS = [
  { to: '/', label: 'Board' },
  { to: '/stats', label: 'Stats' },
  { to: '/teams', label: 'Teams' },
  { to: '/characters', label: 'Characters' },
  { to: '/items', label: 'Items' },
] as const
</script>

<template>
  <header
    class="tt-frame-iron relative z-[1100] flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-3 py-0.5"
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
      <TtButton size="sm" @click="howToPlay">How to play</TtButton>
    </nav>
    <div class="flex flex-wrap items-center justify-center gap-3 lg:ml-auto">
      <!-- The team this browser plays for, with the way out beside it. -->
      <span v-if="my.team" class="flex min-w-0 items-center gap-1.5">
        <TtText :size="1" color="muted" class="hidden whitespace-nowrap 2xl:inline">
          Playing as
        </TtText>
        <TtText
          :size="1"
          font="bold"
          :color="teamColor(my.team)"
          class="max-w-48 truncate"
          :title="`Playing as ${my.team.name}`"
        >
          {{ my.team.name }}
        </TtText>
        <TtText :size="1" color="muted" aria-hidden="true">·</TtText>
        <button type="button" class="tt-link tt-1 whitespace-nowrap" @click="my.logout()">
          Log out
        </button>
      </span>
      <span class="flex items-center gap-1.5" role="status">
        <span
          class="tt-swatch"
          :class="{ 'animate-pulse': connection === 'live' || connection === 'reconnecting' }"
          :style="{ background: badge.color }"
          aria-hidden="true"
        />
        <TtText :size="1" :color="badge.color">{{ badge.label }}</TtText>
      </span>
      <SoundControl />
    </div>
  </header>
</template>
