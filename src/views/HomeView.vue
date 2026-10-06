<script setup lang="ts">
import { useIntervalFn, useNow } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, useTemplateRef, watch } from 'vue'
import ActivityFeed from '@/components/ActivityFeed.vue'
import AlertToasts from '@/components/AlertToasts.vue'
import BoardMap from '@/components/BoardMap.vue'
import EventsPanel from '@/components/EventsPanel.vue'
import GameLog from '@/components/GameLog.vue'
import GemRow from '@/components/GemRow.vue'
import InsetMap from '@/components/InsetMap.vue'
import ShopPanel from '@/components/ShopPanel.vue'
import TeamCard from '@/components/TeamCard.vue'
import TeamControls from '@/components/TeamControls.vue'
import DevTools from '@/components/DevTools.vue'
import type { JournalEntry } from '@/domain/events'
import type { TeamId, TileId } from '@/domain/ids'
import type { Item } from '@/domain/vocabulary'
import { useGameStore } from '@/stores/game'
import { useDevStore } from '@/stores/dev'
import { useTeamStore } from '@/stores/team'
import { teamColor } from '@/ui/colors'

const game = useGameStore()
const my = useTeamStore()
const dev = useDevStore()
const { board, challenges, state, feed, log, loading, standings, alerts, choreography } =
  storeToRefs(game)
const now = useNow({ scheduler: (tick) => useIntervalFn(tick, 1_000) })
const boardMap = useTemplateRef('boardMap')

type Tab = 'play' | 'teams' | 'events' | 'feed' | 'log'
const tab = ref<Tab>('teams')
/** On phones the panel is a bottom sheet that can be tucked away to see more map. */
const sheetOpen = ref(true)
const shopOpen = ref(false)
const insetOpen = ref(true)

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
  { id: 'play' as const, label: my.team ? my.team.name : 'Play' },
  { id: 'teams' as const, label: 'Teams' },
  { id: 'events' as const, label: 'Events', badge: liveCount.value },
  { id: 'feed' as const, label: 'Feed' },
  { id: 'log' as const, label: 'Log' },
])

function openTab(id: Tab) {
  tab.value = id
  shopOpen.value = false
  sheetOpen.value = true
}

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
watch(
  () => my.team?.id,
  (id) => {
    if (id !== undefined) openTab('play')
  },
)

function onHover(tile: TileId) {
  if (!my.targeting) my.previewRoute(tile)
}

/** Every tile, while the dev tools wait for a teleport destination. */
const allTiles = computed(() => new Set(board.value?.tiles.keys() ?? []))

function onPick(tile: TileId) {
  if (dev.pickingTile) void dev.teleport(tile)
  else if (my.targeting?.kind === 'tile') void my.useOn({ kind: 'tile', tileId: tile })
  else my.previewRoute(tile, true)
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
  sheetOpen.value = true
}

async function buy(item: Item) {
  await my.act({ kind: 'buy', item })
}

function locateMine() {
  if (my.team) selectTeam(my.team.id)
}
</script>

<template>
  <p v-if="loading && !state" class="py-24 text-center text-slate-400">Loading the board…</p>

  <div v-if="state && board" class="flex h-full flex-col lg:flex-row">
    <!-- The map and its overlays -->
    <div class="relative min-h-0 min-w-0 flex-1">
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
        :route="my.route"
        :reach="my.targeting || my.drawPhase !== 'idle' ? null : my.reach"
        :target-tiles="dev.pickingTile ? allTiles : my.targetableTiles"
        :hide-cues-for="my.drawPhase !== 'idle' ? my.teamId : null"
        @hover="onHover"
        @pick="onPick"
        @select="selectTeam"
        @free-roam="freeRoam"
        @view="view = $event"
        @open-shop="openShop"
      />

      <!-- Standings strip -->
      <ol
        class="pointer-events-none absolute top-2 left-2 z-[1000] flex max-w-[calc(100%-8rem)] flex-wrap gap-1.5"
        aria-label="Standings"
      >
        <li v-for="(team, i) in standings" :key="team.id" class="pointer-events-auto">
          <button
            type="button"
            class="flex items-center gap-2 rounded-lg border bg-slate-950/85 px-2 py-1 text-xs shadow-lg backdrop-blur hover:bg-slate-900"
            :style="{ borderColor: selected === team.id ? teamColor(team) : 'transparent' }"
            :aria-pressed="selected === team.id"
            :title="`Follow ${team.name}`"
            @click="selectTeam(team.id)"
          >
            <span class="text-slate-500 tabular-nums">{{ i + 1 }}</span>
            <span class="font-bold" :style="{ color: teamColor(team) }">{{ team.name }}</span>
            <GemRow :gems="team.gems" class="hidden scale-75 sm:flex" />
            <span class="text-slate-300 tabular-nums sm:hidden">{{ team.gems.size }}💎</span>
          </button>
        </li>
      </ol>

      <!-- Play-testing tools -->
      <div
        v-if="dev.enabled"
        class="pointer-events-none absolute top-2 right-2 z-[1060] flex justify-end max-sm:top-12"
      >
        <DevTools />
      </div>

      <!-- Alerts -->
      <div class="absolute top-12 left-1/2 z-[1050] -translate-x-1/2 sm:top-3">
        <AlertToasts :alerts="alerts" @dismiss="game.dismiss" />
      </div>

      <!-- Follow / free roam -->
      <div
        v-if="followed"
        class="absolute bottom-2 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950/90 px-3 py-1.5 text-xs shadow-lg"
      >
        <span class="size-2 rounded-full" :style="{ background: teamColor(followed) }" />
        <span v-if="follow" class="text-slate-200">Following {{ followed.name }}</span>
        <span v-else class="text-slate-400">Free roam</span>
        <button
          type="button"
          class="rounded-full bg-slate-800 px-2 py-0.5 text-slate-200 hover:bg-slate-700"
          @click="follow ? (follow = false) : selectTeam(followed.id)"
        >
          {{ follow ? 'Stop' : `Follow ${followed.name}` }}
        </button>
      </div>

      <!-- Map controls -->
      <div class="absolute right-2 bottom-2 z-[1000] flex flex-col gap-1 lg:bottom-3">
        <button type="button" class="map-btn" aria-label="Zoom in" @click="boardMap?.zoomBy(1)">
          +
        </button>
        <button type="button" class="map-btn" aria-label="Zoom out" @click="boardMap?.zoomBy(-1)">
          −
        </button>
        <button
          type="button"
          class="map-btn text-xs"
          aria-label="Show the whole map"
          @click="boardMap?.showAll()"
        >
          ⤢
        </button>
        <button
          type="button"
          class="map-btn text-xs"
          :aria-pressed="insetOpen"
          aria-label="Toggle the overview map"
          @click="insetOpen = !insetOpen"
        >
          🗺
        </button>
      </div>

      <!-- Overview -->
      <div
        v-if="insetOpen"
        class="absolute bottom-2 left-2 z-[1000] w-36 sm:w-52 lg:bottom-3 lg:w-64"
        :class="followed ? 'bottom-12 sm:bottom-2' : ''"
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
      class="z-[1000] flex flex-col border-slate-800 bg-slate-900/95 backdrop-blur max-lg:rounded-t-2xl max-lg:border-t lg:w-[400px] lg:border-l xl:w-[440px]"
      :class="sheetOpen ? 'max-lg:h-[48dvh]' : ''"
    >
      <button
        type="button"
        class="mx-auto my-1 h-1.5 w-12 rounded-full bg-slate-600 lg:hidden"
        :aria-label="sheetOpen ? 'Hide the panel' : 'Show the panel'"
        @click="sheetOpen = !sheetOpen"
      />
      <nav
        class="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-800 px-2"
        role="tablist"
      >
        <button
          v-for="t in TABS"
          :key="t.id"
          type="button"
          role="tab"
          class="relative shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap"
          :class="
            tab === t.id && !shopOpen
              ? 'border-amber-400 text-amber-200'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          "
          :aria-selected="tab === t.id"
          @click="openTab(t.id)"
        >
          {{ t.label }}
          <span
            v-if="t.badge"
            class="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-slate-950"
            >{{ t.badge }}</span
          >
        </button>
      </nav>
      <div v-if="sheetOpen" class="min-h-0 flex-1 overflow-y-auto">
        <ShopPanel
          v-if="shopOpen"
          class="h-full"
          :buyer="buyer"
          :pending="my.pending"
          @buy="buy"
          @close="shopOpen = false"
        />
        <TeamControls v-else-if="tab === 'play'" @open-shop="openShop" @locate="locateMine" />
        <div v-else-if="tab === 'teams'" class="flex flex-col gap-3 p-3">
          <TeamCard
            v-for="(team, i) in standings"
            :key="team.id"
            :team="team"
            :rank="i + 1"
            :state="state"
            :challenges="challenges"
            :names="game.names"
            :now="now"
            :moving="isAnimating(team.id)"
            @locate="selectTeam(team.id)"
          />
        </div>
        <EventsPanel
          v-else-if="tab === 'events'"
          :state="state"
          :challenges="challenges"
          :names="game.names"
          :now="now"
        />
        <ActivityFeed
          v-else-if="tab === 'feed'"
          class="h-full"
          :feed="feed"
          :teams="state.teams"
          :now="now"
        />
        <GameLog
          v-else
          class="h-full"
          :log="log"
          :names="game.names"
          :now="now"
          :revealed="revealed"
        />
      </div>
    </aside>
  </div>
</template>

<style scoped>
@reference '../assets/main.css';

.map-btn {
  @apply grid size-9 place-items-center rounded-lg border border-slate-700 bg-slate-950/90 text-lg text-slate-200 shadow-lg hover:bg-slate-800;
}
</style>
