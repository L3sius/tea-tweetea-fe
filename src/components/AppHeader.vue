<script setup lang="ts">
import { onClickOutside, onKeyStroke, useMediaQuery } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useDinkStore } from '@/stores/dink'
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
const dink = useDinkStore()
const router = useRouter()
const route = useRoute()
// The big title only where the header still fits on one row beside it.
const wide = useMediaQuery('(min-width: 1600px)')
// Below this the pages, tutorial, sound and team fold into a menu, so the header stays one slim row
// and the board keeps the screen.
const roomy = useMediaQuery('(min-width: 1024px)')

/** The tutorial plays on the board. */
async function playTutorial() {
  menuOpen.value = false
  await router.push('/')
  tutorial.start()
}

function showDink() {
  menuOpen.value = false
  dink.show()
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
  { to: '/faq', label: 'FAQ' },
] as const

const menuOpen = ref(false)
const menu = useTemplateRef('menu')
const toggle = useTemplateRef('toggle')
// It closes on the way to a page, on Escape, and on a tap anywhere else.
watch(
  () => route.fullPath,
  () => (menuOpen.value = false),
)
watch(roomy, () => (menuOpen.value = false))
onKeyStroke('Escape', () => (menuOpen.value = false))
onClickOutside(menu, () => (menuOpen.value = false), { ignore: [toggle] })
</script>

<template>
  <header
    v-if="roomy"
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
      <TtButton size="sm" @click="playTutorial">Tutorial</TtButton>
      <TtButton size="sm" @click="showDink">Dink</TtButton>
    </nav>
    <div class="ml-auto flex flex-wrap items-center justify-center gap-3">
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

  <!-- Phones and tablets: one slim row, the rest under the menu button. -->
  <header
    v-else
    class="tt-frame-iron relative z-[1100] flex shrink-0 items-center gap-2 py-0.5 pr-1 pl-3"
  >
    <RouterLink to="/" class="min-w-0 truncate">
      <TtText as="h1" :size="2" font="quill" color="orange" glow class="truncate">
        <!-- The full name doesn't fit beside the buttons on a phone. -->
        <span class="max-[479px]:hidden">Tweetea and the Magic Gems</span>
        <span class="min-[480px]:hidden">Tweetea</span>
      </TtText>
    </RouterLink>
    <span
      class="tt-swatch ml-auto shrink-0"
      :class="{ 'animate-pulse': connection === 'live' || connection === 'reconnecting' }"
      :style="{ background: badge.color }"
      role="status"
      :aria-label="badge.label"
      :title="badge.label"
    />
    <span ref="toggle" class="shrink-0">
      <TtButton
        size="sm"
        class="!min-w-12"
        :selected="menuOpen"
        :aria-expanded="menuOpen"
        aria-controls="site-menu"
        :aria-label="menuOpen ? 'Close the menu' : 'Open the menu'"
        @click="menuOpen = !menuOpen"
      >
        <svg class="menu-icon" viewBox="0 0 9 7" aria-hidden="true">
          <rect y="0" width="9" height="1" />
          <rect y="3" width="9" height="1" />
          <rect y="6" width="9" height="1" />
        </svg>
      </TtButton>
    </span>

    <div
      v-if="menuOpen"
      id="site-menu"
      ref="menu"
      class="tt-frame-iron absolute inset-x-0 top-full mt-1 flex flex-col gap-2 p-3"
    >
      <nav class="grid grid-cols-2 gap-1.5 sm:grid-cols-3" aria-label="Pages">
        <RouterLink
          v-for="link in LINKS"
          :key="link.to"
          v-slot="{ navigate, isActive }"
          :to="link.to"
          custom
        >
          <TtButton
            size="sm"
            class="!w-full"
            :selected="isActive"
            :aria-current="isActive ? 'page' : undefined"
            @click="navigate"
          >
            {{ link.label }}
          </TtButton>
        </RouterLink>
        <TtButton size="sm" class="!w-full" @click="playTutorial">Tutorial</TtButton>
        <TtButton size="sm" class="!w-full" @click="showDink">Dink</TtButton>
      </nav>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span v-if="my.team" class="flex min-w-0 items-center gap-1.5">
          <TtText
            :size="1"
            font="bold"
            :color="teamColor(my.team)"
            class="truncate"
            :title="`Playing as ${my.team.name}`"
          >
            {{ my.team.name }}
          </TtText>
          <TtText :size="1" color="muted" aria-hidden="true">·</TtText>
          <button type="button" class="tt-link tt-1 whitespace-nowrap" @click="my.logout()">
            Log out
          </button>
        </span>
        <span class="flex items-center gap-1.5">
          <span class="tt-swatch" :style="{ background: badge.color }" aria-hidden="true" />
          <TtText :size="1" :color="badge.color">{{ badge.label }}</TtText>
        </span>
        <SoundControl />
      </div>
    </div>
  </header>
</template>

<style scoped>
/* Three bars, drawn on the pixel grid so they stay sharp, as on the map's menu button. */
.menu-icon {
  width: 18px;
  height: 14px;
  fill: currentColor;
  shape-rendering: crispEdges;
  filter: drop-shadow(1px 1px 0 #000);
}
</style>
