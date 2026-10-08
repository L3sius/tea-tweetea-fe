<script setup lang="ts">
import { useIntervalFn, useMediaQuery, useNow } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, useTemplateRef, watch } from 'vue'
import ActivityFeed from '@/components/ActivityFeed.vue'
import AlertToasts from '@/components/AlertToasts.vue'
import BoardMap from '@/components/BoardMap.vue'
import EventsPanel from '@/components/EventsPanel.vue'
import GameLog from '@/components/GameLog.vue'
import InsetMap from '@/components/InsetMap.vue'
import ShopPanel from '@/components/ShopPanel.vue'
import TeamCard from '@/components/TeamCard.vue'
import TeamControls from '@/components/TeamControls.vue'
import DevTools from '@/components/DevTools.vue'
import type { JournalEntry } from '@/domain/events'
import type { TeamId, TileId } from '@/domain/ids'
import { inventorySize } from '@/domain/items'
import type { Item } from '@/domain/vocabulary'
import { useCharacterStore } from '@/stores/characters'
import { useGameStore } from '@/stores/game'
import { useDevStore } from '@/stores/dev'
import { useTeamStore } from '@/stores/team'
import { TILE_COLORS, teamColor } from '@/ui/colors'
import { TtButton, TtPanel, TtText } from '@/ui/tt'

const game = useGameStore()
const my = useTeamStore()
const dev = useDevStore()
const characters = useCharacterStore()
const { board, challenges, state, feed, log, loading, standings, alerts, choreography } =
  storeToRefs(game)
const now = useNow({ scheduler: (tick) => useIntervalFn(tick, 1_000) })
const boardMap = useTemplateRef('boardMap')

/**
 * The overview is all most players need: the followed team's tile and the minigames on now. The
 * rest is for captains (play) and the curious (activity, log).
 */
type Tab = 'overview' | 'play' | 'feed' | 'log'
const tab = ref<Tab>('overview')
/** On phones the panel is a bottom sheet that can be tucked away to see more map. */
const sheetOpen = ref(true)
const shopOpen = ref(false)
/** The overview starts closed on phones, where it would cover most of the map. */
const insetOpen = ref(!useMediaQuery('(max-width: 639px)').value)

const selected = ref<TeamId | null>(null)
const follow = ref(false)
const view = ref<{ south: number; west: number; north: number; east: number } | null>(null)

const liveCount = computed(() => {
  const s = state.value
  if (!s) return 0
  const minigames = [...s.minigames.values()].filter((m) => m.payouts === null).length
  const matches = [...s.matches.values()].filter(
    (m) => m.outcome.kind === 'open' || m.outcome.kind === 'stealing',
  ).length
  return minigames + matches
})

const TABS = computed(() => [
  { id: 'overview' as const, label: 'Overview', badge: liveCount.value },
  { id: 'play' as const, label: 'Play' },
  { id: 'feed' as const, label: 'Activity' },
  { id: 'log' as const, label: 'Log' },
])

const LEGEND = [
  { color: TILE_COLORS.normal, label: 'Tile' },
  { color: TILE_COLORS.red, label: 'Minigame' },
  { color: TILE_COLORS.shop, label: 'Shop' },
]

function openTab(id: Tab) {
  tab.value = id
  sheetOpen.value = true
}

/** The team this viewer last chose to follow, so the overview opens on it next time. */
const WATCH_KEY = 'tweetea.watchTeam'

/** Selecting a team starts following it; dragging the map switches to free roam. */
function selectTeam(id: TeamId) {
  const team = state.value?.teams.get(id)
  if (!team) return
  if (selected.value === id && follow.value) {
    follow.value = false
    return
  }
  selected.value = id
  follow.value = true
  boardMap.value?.locate(team.position, 0.5)
  try {
    localStorage.setItem(WATCH_KEY, String(id))
  } catch {
    // Storage blocked or full: it only saves picking the team again next time.
  }
}

function watchedTeam(): TeamId | null {
  try {
    const saved = Number(localStorage.getItem(WATCH_KEY) ?? NaN)
    return Number.isInteger(saved) && state.value?.teams.has(saved as TeamId)
      ? (saved as TeamId)
      : null
  } catch {
    return null
  }
}

/** The team the overview shows: the one followed, else the captain's own, else the leader. */
const focus = computed(() => followed.value ?? my.team ?? standings.value[0] ?? null)
const focusRank = computed(() =>
  focus.value ? standings.value.findIndex((t) => t.id === focus.value?.id) + 1 : 0,
)

/** A team picked on the map: follow it and show it in the overview. */
function showTeam(id: TeamId) {
  selectTeam(id)
  openTab('overview')
}

function freeRoam() {
  follow.value = false
}

const followed = computed(() =>
  selected.value === null ? null : (state.value?.teams.get(selected.value) ?? null),
)
const isAnimating = (id: TeamId) => choreography.value.isAnimating(id, game.serverNow())
/** The tile a team's piece is on or walking from; refreshed each second through `now`. */
function shownAt(id: TeamId): TileId {
  void now.value
  const p = choreography.value.placement(id, game.serverNow())
  const position = state.value?.teams.get(id)?.position ?? (0 as TileId)
  if (!p) return position
  return p.kind === 'still' ? p.tile : p.progress < 0.5 ? p.from : p.to
}
const revealed = (entry: JournalEntry) => choreography.value.revealAt(entry.seq) <= game.serverNow()

// The managing team's draw: show its options on the map.
watch(
  () => my.walks !== null && my.drawPhase === 'idle',
  (show) => {
    if (show && my.team) boardMap.value?.locate(my.team.position, 0)
  },
)
// Open on a team to follow: the captain's own, else the one this viewer followed last time. It
// waits for the map, which flies to the team.
watch(
  () => [my.team?.id, boardMap.value !== null, state.value !== null] as const,
  ([mine, mapReady, loaded]) => {
    if (!mapReady || !loaded || selected.value !== null) return
    const id = mine ?? watchedTeam()
    if (id !== null) selectTeam(id)
  },
  { immediate: true },
)

/** The walk is shown while the captain picks checkpoints, not while an item waits for a target. */
const picking = computed(() => !my.targeting && !dev.pickingTile && my.drawPhase === 'idle')

function onHover(tile: TileId | null) {
  my.previewTo(picking.value ? tile : null)
}

/** Every tile, while the dev tools wait for a teleport destination. */
const allTiles = computed(() => new Set(board.value?.tiles.keys() ?? []))

function onPick(tile: TileId) {
  if (dev.pickingTile) void dev.teleport(tile)
  else if (my.targeting?.kind === 'tile') void my.useOn({ kind: 'tile', tileId: tile })
  else my.checkpoint(tile)
}

/** The shopping team, when this browser manages one that can buy right now. */
const buyer = computed(() => {
  const t = my.team
  if (!t || !board.value) return null
  const paused = t.status.kind === 'moving' && t.status.move.pauses[0]?.kind === 'shop'
  const standing =
    ['working', 'ready', 'drawn'].includes(t.status.kind) &&
    board.value.tiles.get(t.position)?.kind === 'shop'
  return paused || standing ? t : null
})

function openShop() {
  shopOpen.value = true
}

async function buy(item: Item) {
  await my.act({ kind: 'buy', item })
}
</script>

<template>
  <div v-if="loading && !state" class="flex h-full items-center justify-center">
    <TtText :size="2">Loading the board...</TtText>
  </div>

  <div v-if="state && board" class="relative flex h-full flex-col gap-1.5 lg:flex-row">
    <!-- The map and its overlays, in a stone frame -->
    <div class="tt-frame-stone relative box-border min-h-0 min-w-0 flex-1">
      <BoardMap
        ref="boardMap"
        :board="board"
        :state="state"
        :challenges="challenges"
        :names="game.names"
        :choreography="choreography"
        :server-now="game.serverNow"
        :selected="selected"
        :follow="follow"
        :my-team="my.team"
        :route="picking ? my.path : null"
        :checkpoints="my.checkpoints"
        :preview="picking ? my.preview : null"
        :steps-left="my.stepsLeft"
        :options="picking ? my.options : null"
        :target-tiles="dev.pickingTile ? allTiles : my.targetableTiles"
        :hide-cues-for="my.drawPhase !== 'idle' ? my.teamId : null"
        :appearance-of="characters.appearanceOf"
        @hover="onHover"
        @pick="onPick"
        @free-roam="freeRoam"
        @view="view = $event"
      />

      <!-- Teams to follow: names only; the overview shows the rest of the chosen team. -->
      <ol
        class="pointer-events-none absolute top-1.5 left-1.5 z-[1000] flex max-w-[calc(100%-8rem)] flex-wrap gap-1 max-sm:hidden"
        aria-label="Teams"
      >
        <li v-for="team in standings" :key="team.id" class="pointer-events-auto">
          <button
            type="button"
            class="tt-sprite-display tt-press relative px-2 hover:brightness-[1.18]"
            :class="{ 'tt-pressed': selected === team.id }"
            :aria-pressed="selected === team.id"
            :title="`Follow ${team.name}`"
            @click="showTeam(team.id)"
          >
            <TtText :size="1" font="bold" :color="teamColor(team)">{{ team.name }}</TtText>
            <!-- The followed team: its box's outline in its colour. -->
            <span
              v-if="selected === team.id"
              class="tt-select-ring"
              :style="{ '--ring-color': teamColor(team) }"
              aria-hidden="true"
            />
          </button>
        </li>
      </ol>

      <!-- Play-testing tools -->
      <div
        v-if="dev.enabled"
        class="pointer-events-none absolute top-1.5 right-1.5 z-[1060] flex justify-end"
      >
        <DevTools />
      </div>

      <!-- Alerts -->
      <div class="absolute top-14 left-1/2 z-[1050] -translate-x-1/2 sm:top-3">
        <AlertToasts
          :alerts="alerts"
          @dismiss="game.dismiss"
          @open-events="(id) => (game.dismiss(id), openTab('overview'))"
        />
      </div>

      <!-- Follow / free roam -->
      <div
        v-if="followed"
        class="tt-sprite-display absolute bottom-1.5 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-2 py-0 pr-0 pl-1"
      >
        <span class="tt-swatch" :style="{ background: teamColor(followed) }" />
        <TtText v-if="follow" :size="1" color="white" class="whitespace-nowrap">
          Following {{ followed.name }}
        </TtText>
        <TtText v-else :size="1" color="muted">Free roam</TtText>
        <TtButton
          size="sm"
          class="!min-h-9"
          @click="follow ? (follow = false) : selectTeam(followed.id)"
        >
          {{ follow ? 'Stop' : 'Follow' }}
        </TtButton>
      </div>

      <!-- Map controls -->
      <div class="absolute right-1.5 bottom-1.5 z-[1000] flex flex-col items-end gap-1">
        <div
          class="tt-sprite-display flex flex-col gap-0.5 px-1 py-0 max-sm:hidden"
          aria-label="Map legend"
        >
          <span v-for="l in LEGEND" :key="l.label" class="flex items-center gap-1.5">
            <span class="tt-swatch" :style="{ background: l.color }" />
            <TtText :size="1" color="white">{{ l.label }}</TtText>
          </span>
        </div>
        <div class="flex gap-1">
          <TtButton size="sm" class="map-btn" aria-label="Zoom in" @click="boardMap?.zoomBy(1)">
            +
          </TtButton>
          <TtButton size="sm" class="map-btn" aria-label="Zoom out" @click="boardMap?.zoomBy(-1)">
            -
          </TtButton>
        </div>
        <div class="flex gap-1">
          <TtButton
            size="sm"
            class="map-btn"
            title="Zoom all the way out"
            @click="boardMap?.showAll()"
          >
            All
          </TtButton>
          <TtButton
            size="sm"
            class="map-btn"
            :selected="insetOpen"
            :aria-pressed="insetOpen"
            title="Toggle the overview map"
            @click="insetOpen = !insetOpen"
          >
            Map
          </TtButton>
        </div>
      </div>

      <!-- Overview -->
      <div
        v-if="insetOpen"
        class="absolute bottom-1.5 left-1.5 z-[1000] w-36 sm:w-52 lg:w-64"
        :class="followed ? 'bottom-14 sm:bottom-1.5' : ''"
      >
        <InsetMap
          :board="board"
          :state="state"
          :view="view"
          :selected="selected"
          :shown-at="shownAt"
          @jump="(lat, lng) => boardMap?.panTo(lat, lng)"
          @select="selectTeam"
        />
      </div>
    </div>

    <!-- Side panel (desktop) / bottom sheet (phone) -->
    <aside
      class="z-[1000] flex min-h-0 flex-col gap-1.5 lg:w-[456px]"
      :class="sheetOpen ? 'max-lg:h-[46dvh]' : ''"
    >
      <nav
        class="flex shrink-0 gap-1 max-lg:overflow-x-auto max-lg:pb-1 lg:flex-wrap lg:justify-center"
        role="tablist"
      >
        <TtButton
          v-for="t in TABS"
          :key="t.id"
          size="sm"
          role="tab"
          class="!min-w-0 shrink-0"
          :selected="tab === t.id && sheetOpen"
          :aria-selected="tab === t.id"
          @click="openTab(t.id)"
        >
          {{ t.label }}
          <span v-if="t.badge" :style="{ color: 'var(--osrs-red)' }">({{ t.badge }})</span>
        </TtButton>
        <!-- Phones only: tuck the panel away for more map. -->
        <div class="shrink-0 lg:hidden">
          <TtButton
            size="sm"
            class="!min-w-0"
            :aria-label="sheetOpen ? 'Hide the panel' : 'Show the panel'"
            @click="sheetOpen = !sheetOpen"
          >
            {{ sheetOpen ? 'Hide' : 'Show' }}
          </TtButton>
        </div>
      </nav>
      <div
        v-if="sheetOpen"
        class="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [&>*]:shrink-0"
      >
        <div v-if="tab === 'overview'" class="flex flex-col gap-1.5">
          <TtPanel title="Current tile" width="100%" :padding="12" :gap="10">
            <!-- Which team to watch; the map's standings strip does the same on wider screens. -->
            <div class="flex flex-wrap justify-center gap-1" role="group" aria-label="Team">
              <TtButton
                v-for="team in standings"
                :key="team.id"
                size="sm"
                class="!min-w-0"
                :selected="focus?.id === team.id"
                :aria-pressed="focus?.id === team.id"
                :style="{ '--ring-color': teamColor(team) }"
                @click="selectTeam(team.id)"
              >
                <span :style="{ color: teamColor(team) }">{{ team.name }}</span>
              </TtButton>
            </div>
            <TeamCard
              v-if="focus"
              :team="focus"
              :rank="focusRank"
              :items="my.team?.id === focus.id ? my.items : null"
              :state="state"
              :challenges="challenges"
              :names="game.names"
              :now="now"
              :moving="isAnimating(focus.id)"
              @locate="selectTeam(focus.id)"
            />
          </TtPanel>
          <EventsPanel :state="state" :challenges="challenges" :names="game.names" :now="now" />
        </div>
        <TeamControls v-else-if="tab === 'play'" @open-shop="openShop" />
        <ActivityFeed v-else-if="tab === 'feed'" :feed="feed" :teams="state.teams" :now="now" />
        <GameLog v-else :log="log" :names="game.names" :now="now" :revealed="revealed" />
      </div>
    </aside>

    <!-- The shop opens over everything, like the event site's shop modal -->
    <div v-if="shopOpen" class="tt-overlay" @click.self="shopOpen = false">
      <ShopPanel
        :buyer="buyer"
        :held="inventorySize(my.items)"
        :pending="my.pending"
        @buy="buy"
        @close="shopOpen = false"
      />
    </div>
  </div>
</template>

<style scoped>
.map-btn {
  min-width: 48px !important;
  min-height: 42px !important;
}
</style>
