<script setup lang="ts">
import { onClickOutside, useElementSize, useIntervalFn, useMediaQuery, useNow } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, shallowRef, useTemplateRef, watch } from 'vue'
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
import TeamStripButton from '@/components/TeamStripButton.vue'
import TutorialStage from '@/components/TutorialStage.vue'
import UseItemDialog from '@/components/UseItemDialog.vue'
import DevTools from '@/components/DevTools.vue'
import { MOMENT_LABEL, direct, type Shot } from '@/domain/director'
import type { JournalEntry } from '@/domain/events'
import type { TeamId, TileId } from '@/domain/ids'
import { inventorySize } from '@/domain/items'
import type { Item } from '@/domain/vocabulary'
import { useSoundEffects } from '@/sound/effects'
import { useGameMusic } from '@/sound/gameMusic'
import { useCharacterStore } from '@/stores/characters'
import { byStanding, useGameStore } from '@/stores/game'
import { useDevStore } from '@/stores/dev'
import { useTeamStore } from '@/stores/team'
import type { CameraView } from '@/map/world'
import { useTutorialStore } from '@/stores/tutorial'
import { vTutorial } from '@/tutorial/directive'
import type { SpotName } from '@/tutorial/script'
import { TILE_COLORS, teamColor } from '@/ui/colors'
import { wrapRows } from '@/ui/wrapRows'
import { TtButton, TtPanel, TtText, TtTooltip } from '@/ui/tt'
import { LATER_CARD_MS, replayTime } from '@/domain/replay'

const game = useGameStore()
const my = useTeamStore()
const dev = useDevStore()
const characters = useCharacterStore()
const tutorial = useTutorialStore()
const {
  board: liveBoard,
  challenges: liveChallenges,
  state: liveState,
  feed,
  log,
  loading,
  standings: liveStandings,
  alerts,
  choreography: liveChoreography,
  replayState,
} = storeToRefs(game)

// The tutorial plays on its own frozen world (tutorial/world) with Earl Grey as a team in it
// (tutorial/pretend), so the tour looks the same whatever the live game does; the live game comes
// back when it ends. A "watch from here" replay shows the board as it was at the point it has
// reached, until it goes back to live.
const world = computed(() => (tutorial.staged ? tutorial.world : null))
const board = computed(() => world.value?.board ?? liveBoard.value)
const state = computed(
  () => (world.value ? tutorial.tourState : null) ?? replayState.value ?? liveState.value,
)
const challenges = computed(() => world.value?.challenges ?? liveChallenges.value)
const choreography = computed(() => world.value?.choreography ?? liveChoreography.value)
const names = computed(() => (world.value ? tutorial.tourNames : null) ?? game.names)
const standings = computed(() => {
  const shown = world.value?.state ?? replayState.value
  return shown ? [...shown.teams.values()].sort(byStanding) : liveStandings.value
})
/** The team the entry a "watch from here" replay is playing is about, as the board shows it then. */
const clockTeam = computed(() => {
  const id = game.replayClock?.team
  return id == null ? null : (state.value?.teams.get(id) ?? null)
})
const appearanceOf = (team: TeamId) =>
  world.value
    ? (world.value.state.teams.get(team)?.appearance ?? null)
    : characters.appearanceOf(team)
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
// Below this the page scrolls: the map fills the screen but for a strip at the bottom where the
// panel's tabs show, and the panel follows under it. Wider screens keep the panel beside the map,
// and so do phones held sideways: stacked, their short screen would leave the map no height.
const beside = useMediaQuery(
  '(min-width: 1024px), (orientation: landscape) and (max-height: 500px) and (min-width: 640px)',
)
const short = useMediaQuery('(max-height: 500px)')
const narrow = useMediaQuery('(max-width: 639px)')
/** The team strip across the map's top; small maps leave it out and the overview offers teams. */
const strip = computed(() => !narrow.value && !short.value)
// The strip takes the map's top left but for room for the Dev button at the top right (8rem). Up
// to two rows of teams leave the map clear enough; past that they fold under one button. An
// unseen copy of the strip on one row gives each box's width.
const mapFrame = useTemplateRef('mapFrame')
const teamGhost = useTemplateRef('teamGhost')
const { width: frameWidth } = useElementSize(mapFrame)
const { width: ghostWidth } = useElementSize(teamGhost)
const STRIP_SPARE_PX = 128 + 12
const STRIP_MAX_ROWS = 2
const STRIP_GAP_PX = 4
/** The Auto camera box's extra space before it, set apart from the teams. */
const STRIP_SETTING_GAP_PX = 8
const stripFits = computed(() => {
  const room = frameWidth.value - STRIP_SPARE_PX
  if (ghostWidth.value <= room) return true
  const boxes = [...(teamGhost.value?.children ?? [])].map((el, i, all) => {
    const w = el.getBoundingClientRect().width
    return i === all.length - 1 ? w + STRIP_SETTING_GAP_PX : w
  })
  return wrapRows(boxes, room, STRIP_GAP_PX) <= STRIP_MAX_ROWS
})
const teamsOpen = ref(false)
watch(stripFits, () => (teamsOpen.value = false))
const teamsList = useTemplateRef('teamsList')
const teamsToggle = useTemplateRef('teamsToggle')
onClickOutside(teamsList, () => (teamsOpen.value = false), { ignore: [teamsToggle] })
/** A phone held upright: nothing on the map but its own buttons; the panel under it says the rest. */
const compact = computed(() => !beside.value && !strip.value)
const shopOpen = ref(false)
/** The minigame pick playing now, and the team that landed on the red tile. */
const spin = computed(() => game.spins[0] ?? null)
const spinTeam = computed(() =>
  spin.value?.teamId == null ? null : (state.value?.teams.get(spin.value.teamId) ?? null),
)
/** The overview starts closed on phones, where it would cover most of the map. */
const insetOpen = ref(strip.value)
watch(strip, (on) => (insetOpen.value = on))

const selected = ref<TeamId | null>(null)
const follow = ref(false)
const view = ref<{ south: number; west: number; north: number; east: number } | null>(null)

const liveCount = computed(() => {
  const s = state.value
  if (!s) return 0
  return [...s.minigames.values()].filter((m) => m.payouts === null).length
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
}

// The tutorial shows the side panel on its overview, where the current tile and minigames are, and
// goes back to it whenever it points at either, in case the player has opened another tab.
const SPOT_TABS: Record<SpotName, Tab> = { 'current-tile': 'overview', minigames: 'overview' }
watch(
  () => tutorial.staged && tutorial.revealed.has('panel'),
  (shown) => shown && openTab('overview'),
)
watch(
  () => (tutorial.staged ? tutorial.spotlight : null),
  async (spot) => {
    if (!spot) return
    openTab(SPOT_TABS[spot])
    // Stacked, the panel is below the map: bring the part it points at into view.
    if (beside.value) return
    await nextTick()
    document.querySelector(`[data-tutorial-spot="${spot}"]`)?.scrollIntoView({ block: 'nearest' })
  },
)

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
  // Picking a team makes it the camera's home; an action on screen gives the camera back.
  const borrowed = dropActions()
  if (!borrowed && selected.value === id && follow.value) {
    follow.value = false
    return
  }
  selected.value = id
  // Before the start the team has no piece on the board to follow.
  const placed = state.value?.phase !== 'setup'
  follow.value = placed
  if (placed) boardMap.value?.locate(team.position, 0.5)
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
const focus = computed(() =>
  world.value ? tutorial.guideTeam : (followed.value ?? my.team ?? standings.value[0] ?? null),
)

/** A team picked on the map: follow it and show it in the overview. */
function showTeam(id: TeamId) {
  selectTeam(id)
  openTab('overview')
}

function freeRoam() {
  follow.value = false
  dropActions()
}

// --- Actions: the camera visits whatever is happening and stays there (see domain/director.ts) ---

const ACTIONS_KEY = 'tweetea.followActions'
/** The Auto camera option, remembered for this browser. */
const followActions = ref(readActions())
const ACTIONS_TIP =
  'Moves the camera to each move, item and minigame as it happens, and stays on the last team it showed'
const shot = shallowRef<Shot | null>(null)
/**
 * The viewer's own camera while an action borrows it: the team followed, or free roam (no team
 * followed), and where the view was and how far zoomed. "Back" and turning Actions off return to
 * it. When the action ends by itself the camera stays where it is, so the viewer can see what the
 * team did next.
 */
let home: { team: TeamId | null; follow: boolean; view: CameraView | null } | null = null
/** Actions that started before this (server ms) are left alone: the viewer chose to look elsewhere. */
let ignoreBefore = 0

function readActions(): boolean {
  try {
    return localStorage.getItem(ACTIONS_KEY) === '1'
  } catch {
    return false
  }
}

watch(followActions, (on) => {
  try {
    localStorage.setItem(ACTIONS_KEY, on ? '1' : '0')
  } catch {
    // Kept for this visit only.
  }
  if (!on) goHome()
})

/** An action is on screen now. */
const actionShown = computed(() => followActions.value && !!shot.value && !shot.value.quiet)

/**
 * Lets go of the camera without going home, because the viewer just moved it (picked a team,
 * dragged the map). Actions under way stay ignored. True if an action was on screen.
 */
function dropActions(): boolean {
  const borrowed = actionShown.value
  ignoreBefore = game.serverNow()
  home = null
  if (shot.value) shot.value = { ...shot.value, quiet: true }
  return borrowed
}

/**
 * Back to the viewer's own camera, at the zoom it had: on the team it follows, wherever that team
 * is now, or from free roam on the view it left.
 */
function goHome() {
  const back = home
  home = null
  if (shot.value) shot.value = { ...shot.value, quiet: true }
  if (!back) return
  const team = back.team === null ? undefined : state.value?.teams.get(back.team)
  selected.value = back.team
  if (back.follow && team) {
    follow.value = true
    if (back.view) boardMap.value?.restoreView(back.view, shownAt(team.id))
    else boardMap.value?.locate(shownAt(team.id), 0.5)
  } else {
    follow.value = false
    if (back.view) boardMap.value?.restoreView(back.view)
    else boardMap.value?.showAll()
  }
}

/** "Back" on the action bar: home now, and leave the actions under way alone. */
function skipAction() {
  ignoreBefore = game.serverNow()
  goHome()
}

/**
 * Points the camera at the action the director picks, flying to a new team and following it. Once
 * the action is over the camera keeps following that team; going back is for the viewer to choose.
 */
function directCamera() {
  if (!followActions.value || world.value || game.replay) return
  const time = game.serverNow()
  const before = shot.value
  const moments = game.choreography.momentsAt(time).filter((m) => m.at >= ignoreBefore)
  const next = direct(before, moments, time)
  if (!next || next.quiet) {
    // The team on screen is now the viewer's own camera, so the next action starts from here.
    if (before && !before.quiet) home = null
    shot.value = next
    return
  }
  shot.value = next
  if (before && !before.quiet && before.moment.id === next.moment.id) return
  // The first action to borrow the camera remembers where to bring it back to.
  home ??= {
    team: selected.value,
    follow: follow.value,
    view: boardMap.value?.currentView() ?? null,
  }
  const team = next.moment.teamId
  const fly = !before || before.quiet || team !== before.moment.teamId || !follow.value
  selected.value = team
  follow.value = true
  if (fly) boardMap.value?.locate(shownAt(team), 0.5)
}
useIntervalFn(directCamera, 250)

const followed = computed(() =>
  selected.value === null ? null : (state.value?.teams.get(selected.value) ?? null),
)

/** Back to following the team in the overview, from free roam or after dragging the map. */
function recentre() {
  const team = focus.value
  if (!team || state.value?.phase === 'setup') return
  dropActions()
  selected.value = team.id
  follow.value = true
  boardMap.value?.locate(shownAt(team.id), 0.5)
}

// Sounds play as their moment shows on the board, replays included: big moments for everyone,
// small ones only for your own team or the team you follow. The tour's pretend game stays quiet.
useSoundEffects({
  sources: () => [game.choreography, game.replay?.choreography],
  hears: (cue) =>
    cue.audience === 'everyone' || cue.teamId === my.teamId || cue.teamId === selected.value,
  serverNow: game.serverNow,
  quiet: () => tutorial.staged,
})
// Classic OSRS tracks play under the game, and give way to the tour's own from its first fade.
useGameMusic({ quiet: () => tutorial.active })
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

  <div
    v-if="state && board"
    class="relative flex h-full gap-1.5"
    :class="beside ? 'flex-row' : 'flex-col overflow-y-auto'"
  >
    <!-- The map and its overlays, in a stone frame. Stacked, it leaves room for the tabs below. -->
    <div
      ref="mapFrame"
      class="tt-frame-stone relative box-border min-w-0"
      :class="beside ? 'min-h-0 flex-1' : 'h-[calc(100%-4.25rem)] min-h-64 shrink-0'"
    >
      <BoardMap
        ref="boardMap"
        class="map-tint"
        :class="{ 'map-past': game.replay && !world }"
        :board="board"
        :state="state"
        :challenges="challenges"
        :names="names"
        :choreography="choreography"
        :server-now="game.serverNow"
        :selected="world ? null : selected"
        :follow="follow && !tutorial.staged"
        :my-team="world ? null : my.team"
        :route="!world && picking ? my.path : null"
        :checkpoints="world ? [] : my.checkpoints"
        :preview="!world && picking ? my.preview : null"
        :steps-left="my.stepsLeft"
        :options="!world && picking ? my.options : null"
        :target-tiles="world ? null : dev.pickingTile ? allTiles : my.targetableTiles"
        :hide-cues-for="my.drawPhase !== 'idle' ? my.teamId : null"
        :replay="world ? null : game.replay"
        :dev-quote="world ? null : dev.quote"
        :feed="world ? [] : feed"
        :appearance-of="appearanceOf"
        :layers="tutorial.staged ? tutorial.revealed : null"
        :guide="tutorial.staged ? tutorial.guide : null"
        :inspect="tutorial.staged ? tutorial.inspecting : null"
        @hover="onHover"
        @pick="onPick"
        @free-roam="freeRoam"
        @view="view = $event"
      />

      <!-- Between replayed entries far apart, a title card floats up and fades, like a stage
           direction: "2 hours later". -->
      <div
        v-if="game.replayCard && !world"
        :key="game.replayCard.id"
        class="later-card pointer-events-none absolute inset-x-0 top-[30%] z-[1000] flex justify-center"
        :style="{ animationDuration: `${LATER_CARD_MS}ms` }"
        aria-live="polite"
      >
        <TtText :size="3" font="quill" color="orange" glow>{{ game.replayCard.text }}</TtText>
      </div>

      <!-- The tutorial's tour plays inside the map's frame. -->
      <TutorialStage v-if="tutorial.staged" />

      <!-- Teams to follow: names only; the overview shows the rest of the chosen team. In up to two
           rows where they fit; where they would cover more of the map, folded under one button
           that opens them, wrapped, below it. Open, it stays over the overview map. -->
      <div
        v-if="strip"
        v-tutorial="'teams'"
        class="pointer-events-none absolute top-1.5 left-1.5 flex max-w-[calc(100%-8rem)] flex-wrap items-start gap-1"
        :class="teamsOpen ? 'z-[1010]' : 'z-[1000]'"
      >
        <!-- Its items wrap with the Auto camera box, as one row of boxes. -->
        <ol v-if="stripFits" class="contents" aria-label="Teams">
          <li v-for="team in standings" :key="team.id" class="pointer-events-auto">
            <TeamStripButton
              :team="team"
              :selected="selected === team.id"
              @click="showTeam(team.id)"
            />
          </li>
        </ol>
        <button
          v-else
          ref="teamsToggle"
          type="button"
          class="tt-sprite-display tt-press pointer-events-auto flex max-w-full min-w-0 items-center gap-1.5 px-2 hover:brightness-[1.18]"
          :class="{ 'tt-pressed': teamsOpen }"
          :aria-expanded="teamsOpen"
          :aria-label="
            followed ? `Following ${followed.name}: pick a team` : `Pick a team to follow`
          "
          @click="teamsOpen = !teamsOpen"
        >
          <TtText
            :size="1"
            font="bold"
            :color="followed ? teamColor(followed) : 'white'"
            class="truncate"
          >
            {{ followed?.name ?? 'Teams' }}
          </TtText>
          <svg class="caret-icon shrink-0" viewBox="0 0 7 4" aria-hidden="true">
            <rect x="0" y="0" width="7" height="1" />
            <rect x="1" y="1" width="5" height="1" />
            <rect x="2" y="2" width="3" height="1" />
            <rect x="3" y="3" width="1" height="1" />
          </svg>
        </button>
        <!-- A setting, not a team: set apart, in plain text, with the game's tick or cross box. -->
        <TtTooltip class="pointer-events-auto ml-2 shrink-0">
          <button
            type="button"
            class="tt-sprite-display tt-press flex items-center gap-1.5 px-2 whitespace-nowrap hover:brightness-[1.18]"
            :aria-pressed="followActions"
            @click="followActions = !followActions"
          >
            <span
              class="tt-sprite block size-4"
              :class="followActions ? 'tt-icon-check' : 'tt-icon-cross'"
              aria-hidden="true"
            />
            <TtText :size="1" color="white">Auto camera</TtText>
          </button>
          <template #tip>{{ ACTIONS_TIP }}</template>
        </TtTooltip>
        <ol
          v-if="!stripFits && teamsOpen"
          ref="teamsList"
          class="flex basis-full flex-wrap gap-1"
          aria-label="Teams"
        >
          <li v-for="team in standings" :key="team.id" class="pointer-events-auto">
            <TeamStripButton
              :team="team"
              :selected="selected === team.id"
              @click="(showTeam(team.id), (teamsOpen = false))"
            />
          </li>
        </ol>
        <!-- The whole strip on one row, unseen, to tell whether it fits. -->
        <ol
          ref="teamGhost"
          class="invisible absolute top-0 left-0 flex w-max gap-1"
          aria-hidden="true"
        >
          <li v-for="team in standings" :key="team.id">
            <TeamStripButton :team="team" :selected="false" tabindex="-1" />
          </li>
          <li class="ml-2">
            <span class="tt-sprite-display flex items-center gap-1.5 px-2 whitespace-nowrap">
              <span class="block size-4" />
              <TtText :size="1">Auto camera</TtText>
            </span>
          </li>
        </ol>
      </div>

      <!-- Play-testing tools -->
      <div
        v-if="dev.enabled && !tutorial.staged"
        class="pointer-events-none absolute top-1.5 right-1.5 z-[1060] flex justify-end"
      >
        <DevTools />
      </div>

      <!-- Alerts -->
      <div
        v-if="!tutorial.staged"
        class="absolute top-14 left-1/2 z-[1050] -translate-x-1/2 sm:top-3"
      >
        <AlertToasts
          :alerts="alerts"
          @dismiss="game.dismiss"
          @open-events="(id) => (game.dismiss(id), openTab('overview'))"
        />
      </div>

      <!-- Bars at the bottom middle, stacked so they never overlap: a replay (or moves to catch up
           on), then who the camera follows. Small maps put them top left, where bigger ones show the
           team strip, so they stay clear of the map's corner buttons. -->
      <div
        v-if="game.replay || (!compact && (game.missedMoves > 0 || followed || actionShown))"
        v-tutorial="'controls'"
        class="absolute z-[1000] flex flex-col gap-1"
        :class="
          strip
            ? 'bottom-1.5 left-1/2 -translate-x-1/2 items-center'
            : // Below the Dev button, which shares the top of a small map when it is on.
              ['left-1.5 items-start', dev.enabled && !tutorial.staged ? 'top-15' : 'top-1.5']
        "
      >
        <div
          v-if="game.replay || (!compact && game.missedMoves > 0)"
          class="tt-sprite-display flex items-center gap-2 py-0 pr-0 pl-1"
          role="status"
        >
          <template v-if="game.replay && game.replayClock">
            <TtText :size="1" color="orange" class="whitespace-nowrap">Replaying</TtText>
            <TtText :size="1" color="white" class="whitespace-nowrap">
              <span v-if="clockTeam" :style="{ color: teamColor(clockTeam) }">{{
                clockTeam.name
              }}</span>
              at {{ replayTime(game.replayClock.at, now) }}
            </TtText>
          </template>
          <template v-else-if="game.replay">
            <TtText :size="1" color="orange" class="whitespace-nowrap">Replay</TtText>
            <TtText :size="1" color="white" class="whitespace-nowrap">{{
              game.replayLabel
            }}</TtText>
          </template>
          <template v-if="game.replay">
            <TtText
              v-if="game.replayProgress && game.replayCountdown === null"
              :size="1"
              color="muted"
              class="whitespace-nowrap"
            >
              · {{ game.replayProgress.done }} of {{ game.replayProgress.total }}
            </TtText>
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
              <span class="tt-sprite tt-icon-cross block size-4" aria-hidden="true"></span>
            </button>
          </template>
        </div>

        <!-- Following the action: the team the camera is on, and what it is doing -->
        <div
          v-if="!compact && actionShown && shot && followed"
          class="tt-sprite-display flex items-center gap-2 py-0 pr-0 pl-1"
          role="status"
        >
          <TtText :size="1" color="white" class="whitespace-nowrap">
            <span :style="{ color: teamColor(followed) }">{{ followed.name }}</span> ·
            {{ MOMENT_LABEL[shot.moment.kind] }}
          </TtText>
          <TtButton size="sm" class="!min-h-9" @click="skipAction()">Back</TtButton>
        </div>
        <!-- Follow / free roam; before the start there is no piece to follow -->
        <div
          v-else-if="!compact && followed && state?.phase !== 'setup'"
          class="tt-sprite-display flex items-center gap-2 py-0 pr-0 pl-1"
        >
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
              v-if="focus && state?.phase !== 'setup'"
              size="sm"
              class="map-btn"
              :aria-label="`Follow ${focus.name}`"
              :title="`Follow ${focus.name}`"
              @click="recentre()"
            >
              <svg class="menu-icon" viewBox="0 0 9 9" aria-hidden="true">
                <rect x="4" y="0" width="1" height="9" />
                <rect x="0" y="4" width="9" height="1" />
                <rect x="2" y="2" width="5" height="1" />
                <rect x="2" y="6" width="5" height="1" />
                <rect x="2" y="2" width="1" height="5" />
                <rect x="6" y="2" width="1" height="5" />
              </svg>
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

    <!-- The panel: beside the map, or under it on a page that scrolls -->
    <aside
      v-tutorial="'panel'"
      class="z-[1000] flex flex-col gap-1.5"
      :class="beside ? 'min-h-0 w-[min(456px,48%)] shrink-0' : 'shrink-0'"
    >
      <nav
        class="flex shrink-0 gap-1"
        :class="beside ? 'flex-wrap justify-center' : 'overflow-x-auto pb-1'"
        role="tablist"
      >
        <TtButton
          v-for="t in TABS"
          :key="t.id"
          size="sm"
          role="tab"
          class="!min-w-0 shrink-0"
          :selected="tab === t.id"
          :aria-selected="tab === t.id"
          @click="openTab(t.id)"
        >
          {{ t.label }}
          <span v-if="t.badge" :style="{ color: 'var(--osrs-red)' }">({{ t.badge }})</span>
        </TtButton>
      </nav>
      <!-- The scrollbar's space is always kept: the logo shrinks with the panel, so a scrollbar that
           took its width could shorten the content, vanish, and come back, flickering. -->
      <div
        class="flex flex-col overflow-x-hidden [&>*]:shrink-0"
        :class="{ 'min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]': beside }"
      >
        <div v-if="tab === 'overview'" class="flex flex-col gap-1.5">
          <TtPanel
            title="Current tile"
            width="100%"
            :padding="12"
            :gap="10"
            data-tutorial-spot="current-tile"
          >
            <!-- Which team to watch, where the map is too small for its team strip (phones, and
                 phones held sideways): bigger maps pick it on the strip. -->
            <div
              v-if="!strip"
              class="flex flex-wrap justify-center gap-1"
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
              <TtTooltip class="ml-2">
                <TtButton
                  size="sm"
                  class="!min-w-0"
                  :aria-pressed="followActions"
                  @click="followActions = !followActions"
                >
                  <span class="flex items-center gap-1.5">
                    <span
                      class="tt-sprite block size-4"
                      :class="followActions ? 'tt-icon-check' : 'tt-icon-cross'"
                      aria-hidden="true"
                    />
                    <span class="text-white">Auto camera</span>
                  </span>
                </TtButton>
                <template #tip>{{ ACTIONS_TIP }}</template>
              </TtTooltip>
            </div>
            <TeamCard
              v-if="focus"
              :team="focus"
              :items="!world && my.team?.id === focus.id ? my.items : null"
              :state="state"
              :challenges="challenges"
              :names="names"
              :now="now"
              :moving="isAnimating(focus.id)"
            />
            <TtText v-else-if="state.teams.size === 0" :size="1" color="muted"
              >No teams yet. The game starts once the admin has made them.</TtText
            >
          </TtPanel>
          <EventsPanel
            :state="state"
            :challenges="challenges"
            :names="names"
            :now="now"
            data-tutorial-spot="minigames"
          />
        </div>
        <TeamControls v-else-if="tab === 'play'" @open-shop="openShop" />
        <ActivityFeed v-else-if="tab === 'feed'" :feed="feed" :teams="state.teams" :now="now" />
        <GameLog
          v-else
          :log="log"
          :names="names"
          :teams="state.teams"
          :now="now"
          :revealed="revealed"
          @watch="game.watchMove"
          @watch-from="(seq) => game.watchFrom(seq)"
        />
      </div>
    </aside>

    <!-- Using an item asks first; a target picked on the map is part of the question. -->
    <!-- During the tutorial, the player's own dialogs and the live game's slot machine wait. -->
    <UseItemDialog
      v-if="my.confirming && !world"
      :use="my.confirming"
      @confirm="my.confirmUse()"
      @cancel="my.cancelUse()"
    />

    <!-- The shop opens over everything, like the event site's shop modal -->
    <div v-if="shopOpen && !world" class="tt-overlay" @click.self="closeShop">
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
    <div v-if="spin && !world" class="tt-overlay">
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
/* A replay shows the past: the map takes on an old-photo tint while it plays. */
.map-tint {
  transition: filter 0.6s ease;
}
.map-past {
  filter: sepia(0.45) saturate(0.85) brightness(0.92);
}
/* Fades in as it rises, holds, then drifts on up and fades out. */
.later-card {
  animation: later-card ease-out forwards;
}
@keyframes later-card {
  0% {
    opacity: 0;
    transform: translateY(24px);
  }
  20% {
    opacity: 1;
    transform: translateY(0);
  }
  70% {
    opacity: 1;
    transform: translateY(-12px);
  }
  100% {
    opacity: 0;
    transform: translateY(-40px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .later-card {
    animation-name: later-card-still;
  }
}
@keyframes later-card-still {
  0%,
  100% {
    opacity: 0;
  }
  20%,
  70% {
    opacity: 1;
  }
}
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
/* The folded team strip's caret: a small pixel triangle pointing down. */
.caret-icon {
  width: 14px;
  height: 8px;
  fill: currentColor;
  color: #fff;
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
