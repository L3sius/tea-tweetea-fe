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
import MinigameSpin from '@/components/MinigameSpin.vue'
import ShopPanel from '@/components/ShopPanel.vue'
import TeamCard from '@/components/TeamCard.vue'
import TeamControls from '@/components/TeamControls.vue'
import UseItemDialog from '@/components/UseItemDialog.vue'
import DevTools from '@/components/DevTools.vue'
import type { JournalEntry } from '@/domain/events'
import type { TeamId, TileId } from '@/domain/ids'
import { inventorySize } from '@/domain/items'
import type { Item } from '@/domain/vocabulary'
import { useCharacterStore } from '@/stores/characters'
import { useGameStore } from '@/stores/game'
import { useDevStore } from '@/stores/dev'
import { useTeamStore } from '@/stores/team'
import { useTutorialStore } from '@/stores/tutorial'
import { vTutorial } from '@/tutorial/directive'
import { TILE_COLORS, teamColor } from '@/ui/colors'
import { TtButton, TtPanel, TtText } from '@/ui/tt'

const game = useGameStore()
const my = useTeamStore()
const dev = useDevStore()
const characters = useCharacterStore()
const tutorial = useTutorialStore()
const { board, challenges, state, feed, log, loading, standings, alerts, choreography } =
  storeToRefs(game)
const now = useNow({ scheduler: (tick) => useIntervalFn(tick, 1_000) })
const boardMap = useTemplateRef('boardMap')

// The tutorial flies the camera as its script says.
watch(
  () => tutorial.camera,
  (move) => {
    if (!move) return
    if (move.to === 'all') boardMap.value?.showAll(move.ms)
    else boardMap.value?.locate(move.to, move.zoom, move.ms)
  },
)

/**
 * The overview is all most players need: the followed team's tile and the minigames on now. The
 * rest is for captains (play) and the curious (activity, log).
 */
type Tab = 'overview' | 'play' | 'feed' | 'log'
const tab = ref<Tab>('overview')
/** On phones the panel is a bottom sheet that can be tucked away to see more map. */
const sheetOpen = ref(true)
const shopOpen = ref(false)
/** The minigame pick playing now, and the team that landed on the red tile. */
const spin = computed(() => game.spins[0] ?? null)
const spinTeam = computed(() =>
  spin.value?.teamId == null ? null : (state.value?.teams.get(spin.value.teamId) ?? null),
)
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

/** The map's own markers: tiles and minigame tiles are nodes, a red one bigger; shops are coins. */
const LEGEND = [
  { label: 'Tile', node: TILE_COLORS.normal, size: 12 },
  { label: 'Minigame', node: TILE_COLORS.red, size: 16 },
  { label: 'Shop', node: null, size: 20 },
]
/** The map's legend and buttons stay folded away under a menu button until asked for. */
const controlsOpen = ref(false)

function openTab(id: Tab) {
  tab.value = id
  sheetOpen.value = true
}

/** The team this viewer last chose to follow, so the overview opens on it next time. */
const WATCH_KEY = 'tweetea.watchTeam'

/** Selecting a team starts following it; dragging the map switches to free roam. */
// A replay moves the camera along: it flies in to each team as its replayed move starts (never
// zooming out), then follows it.
watch(
  () => game.replayFocus,
  (focus) => {
    if (focus === null) return
    selected.value = focus.team
    follow.value = true
    if (focus.tile !== null) boardMap.value?.locate(focus.tile, 0.5)
  },
)

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
  else if (my.targeting?.kind === 'tile') my.useOn({ kind: 'tile', tileId: tile })
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

/** What the shop the team stands on stocks. */
const shopStock = computed(() => {
  const t = my.team
  return (t && state.value?.shops.get(t.position)) ?? []
})

function openShop() {
  shopOpen.value = true
}

/** The shop stays open while a mystery box's reel spins, so the reel is never cut short. */
function closeShop() {
  if (!my.opening) shopOpen.value = false
}

async function buy(item: Item) {
  await my.act({ kind: 'buy', item })
}

async function buyMysteryBox() {
  await my.buyMysteryBox()
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
        :follow="follow && !tutorial.active"
        :my-team="my.team"
        :route="picking ? my.path : null"
        :checkpoints="my.checkpoints"
        :preview="picking ? my.preview : null"
        :steps-left="my.stepsLeft"
        :options="picking ? my.options : null"
        :target-tiles="dev.pickingTile ? allTiles : my.targetableTiles"
        :hide-cues-for="my.drawPhase !== 'idle' ? my.teamId : null"
        :replay="game.replay"
        :dev-quote="dev.quote"
        :appearance-of="characters.appearanceOf"
        :layers="tutorial.active ? tutorial.revealed : null"
        :guide="tutorial.phase === 'playing' ? tutorial.guide : null"
        @hover="onHover"
        @pick="onPick"
        @free-roam="freeRoam"
        @view="view = $event"
      />

      <!-- Teams to follow: names only; the overview shows the rest of the chosen team. -->
      <ol
        v-tutorial="'teams'"
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
        v-if="dev.enabled && !tutorial.active"
        class="pointer-events-none absolute top-1.5 right-1.5 z-[1060] flex justify-end"
      >
        <DevTools />
      </div>

      <!-- Alerts -->
      <div
        v-if="!tutorial.active"
        class="absolute top-14 left-1/2 z-[1050] -translate-x-1/2 sm:top-3"
      >
        <AlertToasts
          :alerts="alerts"
          @dismiss="game.dismiss"
          @open-events="(id) => (game.dismiss(id), openTab('overview'))"
        />
      </div>

      <!-- Bars at the bottom middle, stacked so they never overlap: a replay (or moves to catch up
           on), then who the camera follows. -->
      <div
        v-if="game.replay || game.missedMoves > 0 || followed"
        v-tutorial="'controls'"
        class="absolute bottom-1.5 left-1/2 z-[1000] flex -translate-x-1/2 flex-col items-center gap-1"
      >
        <div
          v-if="game.replay || game.missedMoves > 0"
          class="tt-sprite-display flex items-center gap-2 py-0 pr-0 pl-1"
          role="status"
        >
          <template v-if="game.replay">
            <TtText :size="1" color="orange" class="whitespace-nowrap">Replay</TtText>
            <TtText :size="1" color="white" class="whitespace-nowrap">{{
              game.replayLabel
            }}</TtText>
            <TtText
              v-if="game.replayCountdown !== null"
              :size="1"
              color="muted"
              class="whitespace-nowrap"
              aria-live="polite"
            >
              · Back to live in {{ game.replayCountdown }}
            </TtText>
            <TtButton size="sm" class="!min-h-9" @click="game.stopReplay()">Stop replay</TtButton>
          </template>
          <template v-else>
            <TtText :size="1" color="white" class="whitespace-nowrap">
              While you were away: {{ game.missedMoves }}
              {{ game.missedMoves === 1 ? 'move' : 'moves' }}
            </TtText>
            <TtButton size="sm" class="!min-h-9" @click="game.catchUp()">Catch up</TtButton>
            <button
              type="button"
              class="tt-link tt-1 pr-2"
              aria-label="Dismiss"
              title="Dismiss"
              @click="game.dismissCatchUp()"
            >
              ✕
            </button>
          </template>
        </div>

        <!-- Follow / free roam -->
        <div v-if="followed" class="tt-sprite-display flex items-center gap-2 py-0 pr-0 pl-1">
          <TtText v-if="follow" :size="1" color="white" class="whitespace-nowrap">
            Following
            <span :style="{ color: teamColor(followed) }">{{ followed.name }}</span>
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
      </div>

      <!-- Map controls, folded under a menu button -->
      <div
        v-tutorial="'controls'"
        class="absolute right-1.5 bottom-1.5 z-[1000] flex flex-col items-end gap-1"
      >
        <template v-if="controlsOpen">
          <div class="tt-sprite-display flex flex-col gap-0.5 px-1 py-0" aria-label="Map legend">
            <span v-for="l in LEGEND" :key="l.label" class="flex items-center gap-1.5">
              <span class="grid size-5 place-items-center" aria-hidden="true">
                <span
                  v-if="l.node"
                  class="legend-node"
                  :style="{ background: l.node, width: `${l.size}px`, height: `${l.size}px` }"
                />
                <span v-else class="tt-sprite tt-icon-coins size-5" />
              </span>
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
        </template>
        <TtButton
          size="sm"
          class="map-btn"
          :selected="controlsOpen"
          :aria-expanded="controlsOpen"
          :aria-label="controlsOpen ? 'Hide the map controls' : 'Show the map controls'"
          :title="controlsOpen ? 'Hide the map controls' : 'Legend, zoom and overview'"
          @click="controlsOpen = !controlsOpen"
        >
          <svg class="menu-icon" viewBox="0 0 9 7" aria-hidden="true">
            <rect y="0" width="9" height="1" />
            <rect y="3" width="9" height="1" />
            <rect y="6" width="9" height="1" />
          </svg>
        </TtButton>
      </div>

      <!-- Overview -->
      <div
        v-if="insetOpen"
        v-tutorial="'controls'"
        class="absolute bottom-1.5 left-1.5 z-[1000] w-36 sm:w-52 lg:w-64"
        :class="
          game.replay || game.missedMoves > 0
            ? 'bottom-26 sm:bottom-1.5'
            : followed
              ? 'bottom-14 sm:bottom-1.5'
              : ''
        "
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
      v-tutorial="'panel'"
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
            <!-- Which team to watch, on phones only: wider screens pick it on the map's team strip,
                 which phones hide to keep the small map clear. -->
            <div
              class="flex flex-wrap justify-center gap-1 sm:hidden"
              role="group"
              aria-label="Team"
            >
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
              :items="my.team?.id === focus.id ? my.items : null"
              :state="state"
              :challenges="challenges"
              :names="game.names"
              :now="now"
              :moving="isAnimating(focus.id)"
            />
          </TtPanel>
          <EventsPanel :state="state" :challenges="challenges" :names="game.names" :now="now" />
        </div>
        <TeamControls v-else-if="tab === 'play'" @open-shop="openShop" />
        <ActivityFeed v-else-if="tab === 'feed'" :feed="feed" :teams="state.teams" :now="now" />
        <GameLog
          v-else
          :log="log"
          :names="game.names"
          :teams="state.teams"
          :now="now"
          :revealed="revealed"
          @watch="game.watchMove"
        />
      </div>
    </aside>

    <!-- Using an item asks first; a target picked on the map is part of the question. -->
    <UseItemDialog
      v-if="my.confirming"
      :use="my.confirming"
      @confirm="my.confirmUse()"
      @cancel="my.cancelUse()"
    />

    <!-- The shop opens over everything, like the event site's shop modal -->
    <div v-if="shopOpen" class="tt-overlay" @click.self="closeShop">
      <ShopPanel
        :buyer="buyer"
        :stock="shopStock"
        :held="inventorySize(my.items)"
        :inventory-limit="game.rules?.inventoryLimit ?? 0"
        :pending="my.pending"
        :opening="my.opening"
        @buy="buy"
        @buy-mystery-box="buyMysteryBox"
        @opened="my.boxOpened()"
        @close="closeShop"
      />
    </div>

    <!-- A minigame being picked: a slot machine over the map, which can't be skipped. -->
    <div v-if="spin" class="tt-overlay">
      <MinigameSpin
        :key="spin.id"
        :spin="spin"
        :team-name="spinTeam?.name ?? null"
        :team-color="spinTeam ? teamColor(spinTeam) : 'var(--osrs-white)'"
        @done="game.finishSpin(spin.id)"
      />
    </div>
  </div>
</template>

<style scoped>
.map-btn {
  min-width: 48px !important;
  min-height: 42px !important;
}
/* Three bars, drawn on the pixel grid so they stay sharp. */
.menu-icon {
  width: 18px;
  height: 14px;
  fill: currentColor;
  shape-rendering: crispEdges;
  filter: drop-shadow(1px 1px 0 #000);
}
/* A tile node as the map draws it: a filled circle with a thin black edge. */
.legend-node {
  box-sizing: border-box;
  border: 2px solid #000;
  border-radius: 50%;
}
</style>
