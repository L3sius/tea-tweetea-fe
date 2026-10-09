import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef } from 'vue'
import { ticksToMs, type Performance } from '@/characters/acting'
import { animationInfoOf, loadAnimationInfo } from '@/characters/assets'
import { RUN_FROM_STEPS } from '@/characters/roster'
import type { GameEvent } from '@/domain/events'
import { tileId, type TileId } from '@/domain/ids'
import { Choreography, type Placement } from '@/domain/motion'
import { GUIDE, GUIDE_TEAM } from '@/tutorial/guide'
import * as music from '@/tutorial/music'
import { loadTutorialWorld, type TutorialWorld } from '@/tutorial/world'
import {
  GESTURE,
  TOUR_START,
  TUTORIAL,
  type Action,
  type Cue,
  type RevealName,
  type SpotName,
} from '@/tutorial/script'
import { useGameStore } from './game'

const SEEN_KEY = 'tweetea.tutorial'
/** Bump when the tutorial changes enough that everyone should see it again. */
const VERSION = '1'
/** How long an overhead line stays up, unless the script says. */
const SAY_MS = 2600
/** How close the camera is on Earl Grey in the title scene and the welcome. */
const TITLE_ZOOM = 1.5
/** Assumed for a gesture whose length hasn't loaded. */
const GESTURE_MS = 2000
/** How long the page takes to fade to black, then to fade in again on the title scene. */
export const TO_BLACK_MS = 700
export const FROM_BLACK_MS = 900

/** A camera move for the map to make; a new id each time, so the same move can repeat. */
export type CameraMove = { id: number; to: 'all' | TileId; zoom?: number; ms: number }

/** What BoardMap needs to draw Earl Grey; read every frame, so plain functions, not state. */
export type Guide = {
  npc: number
  name: string
  placement: (time: number) => Placement | null
  performance: (time: number, placement: Placement) => Performance
  /** His overhead line at `time`, if any. */
  say: (time: number) => string | null
}

/**
 * The tutorial: a guided tour of the board for new players, shown on a first visit and again from
 * "How to play". It plays the script in tutorial/script.ts over the live page, which it hides and
 * reveals part by part (see RevealName), with Earl Grey walking the map.
 */
export const useTutorialStore = defineStore('tutorial', () => {
  const game = useGameStore()

  const seen = ref(readSeen())
  /**
   * `fading`: the page fades to black, unchanged under it. `title`: the tour's own scene, with the
   * map dark and Earl Grey waving over "How to play". `playing`: the tour.
   */
  const phase = ref<'off' | 'fading' | 'title' | 'playing'>('off')
  /** The black cover over the page, while it fades in and out again. */
  const cover = ref(false)
  const beat = ref(0)
  const line = ref(0)
  const revealed = shallowRef<ReadonlySet<RevealName>>(new Set())
  const camera = shallowRef<CameraMove | null>(null)
  /** The tile whose task card shows, as when hovering a node. */
  const inspecting = ref<TileId | null>(null)
  /** The part of the page outlined. */
  const spotlight = ref<SpotName | null>(null)
  /** The minigame slot machine, while it spins. */
  const spin = shallowRef<{ id: number; winner: string } | null>(null)
  /** The shop whose panel is open. */
  const shopTile = ref<TileId | null>(null)
  /** The board and game the tour is shown on (tutorial/world), once loaded. */
  const world = shallowRef<TutorialWorld | null>(null)
  const muted = ref(music.isMuted())

  const active = computed(() => phase.value !== 'off')
  /** The page is the tour's scene: parts of it hidden, Earl Grey on the map. */
  const staged = computed(() => phase.value === 'title' || phase.value === 'playing')
  const current = computed(() => TUTORIAL[beat.value] ?? null)
  const text = computed(() => current.value?.lines[line.value]?.text ?? '')
  const isFirst = computed(() => beat.value === 0 && line.value === 0)
  const isLast = computed(
    () =>
      beat.value === TUTORIAL.length - 1 && line.value === (current.value?.lines.length ?? 1) - 1,
  )

  /** Whether a part of the page shows: everything does outside the tutorial's scene. */
  const shows = (name: RevealName) => !staged.value || revealed.value.has(name)

  // --- Earl Grey ---

  let choreography = new Choreography()
  let seq = 0
  let tile: TileId | null = null
  let gesture: { anim: number; since: number; until: number } | null = null
  let saying: { text: string; until: number } | null = null
  /** Where he stood as each beat began, so going back puts him there again. */
  const beatTiles = new Map<number, TileId>()
  let cameraId = 0

  const guide: Guide = markRaw({
    npc: GUIDE.npc,
    name: GUIDE.name,
    placement: (time: number) =>
      choreography.placement(GUIDE_TEAM, time) ?? (tile === null ? null : { kind: 'still', tile }),
    performance: (time: number, p: Placement): Performance => {
      if (p.kind === 'walk')
        return { anim: p.steps >= RUN_FROM_STEPS ? GUIDE.run : GUIDE.walk, since: 0, rate: 1 }
      if (gesture && time >= gesture.since && time < gesture.until)
        return { anim: gesture.anim, since: gesture.since, rate: 1 }
      return { anim: GUIDE.idle, since: 0, rate: 1 }
    },
    say: (time: number) => (saying && time < saying.until ? saying.text : null),
  })

  /** Puts him on `at`, standing still. */
  function place(at: TileId | null) {
    choreography = new Choreography()
    tile = at
    if (at !== null) choreography.know(GUIDE_TEAM, at)
  }

  /** Walks him along `route` (tiles of the tutorial's board, from where he stands). */
  function walk(route: readonly number[]) {
    const path = route.map(tileId)
    if (path.length < 2) return
    const events: GameEvent[] = [
      { kind: 'move_confirmed', teamId: GUIDE_TEAM, path },
      ...path.slice(1).map((t): GameEvent => ({ kind: 'stepped', teamId: GUIDE_TEAM, tileId: t })),
    ]
    choreography.apply({ seq: ++seq, at: new Date(game.serverNow()), events })
    tile = path[path.length - 1] ?? tile
  }

  function gestureNow(name: keyof typeof GESTURE) {
    const anim = GESTURE[name]
    const info = animationInfoOf(anim)
    const since = game.serverNow()
    gesture = { anim, since, until: since + (info ? ticksToMs(info.ticks) : GESTURE_MS) }
  }

  // --- The script ---

  type Pending = { timer: ReturnType<typeof setTimeout> | undefined; action: Action }
  /** Cues waiting to happen: the beat's own, and the showing line's. */
  const pending: Record<'beat' | 'line', Pending[]> = { beat: [], line: [] }

  function run(action: Action) {
    switch (action.kind) {
      case 'reveal':
        revealed.value = new Set([...revealed.value, ...action.what])
        return
      case 'camera': {
        const to = action.to === 'all' ? 'all' : tile
        if (to !== null) camera.value = { id: ++cameraId, to, zoom: action.zoom, ms: action.ms }
        return
      }
      case 'walk':
        return walk(action.path)
      case 'inspect':
        inspecting.value = tile
        return
      case 'spotlight':
        spotlight.value = action.target
        return
      case 'spin':
        spin.value = { id: ++spinId, winner: action.winner }
        return
      case 'shop':
        shopTile.value = tile
        return
      case 'gesture':
        return gestureNow(action.gesture)
      case 'say':
        saying = { text: action.text, until: game.serverNow() + (action.ms ?? SAY_MS) }
    }
  }

  let spinId = 0

  /** How long until Earl Grey stops walking (0 when he stands). */
  const walkLeft = () => Math.max(0, choreography.settlesAt(GUIDE_TEAM) - game.serverNow())

  function schedule(owner: 'beat' | 'line', cues: readonly Cue[] = []) {
    for (const cue of cues) {
      const entry: Pending = { timer: undefined, action: cue.action }
      // A cue for his arrival waits for any walk under way when it's due, even one that started
      // after it was scheduled.
      const due = () => {
        const left = cue.afterWalk ? walkLeft() : 0
        if (left > 0) {
          entry.timer = setTimeout(due, left + cue.at)
          return
        }
        pending[owner] = pending[owner].filter((p) => p !== entry)
        run(cue.action)
      }
      entry.timer = setTimeout(due, cue.at + (cue.afterWalk ? walkLeft() : 0))
      pending[owner].push(entry)
    }
  }

  /**
   * Cancels what hasn't happened yet. Skipping ahead still builds the board and moves Earl Grey,
   * so the next line finds them as the script left them; flavour and gestures are dropped, and of
   * several camera moves only the last is made.
   */
  function flush(owner: 'beat' | 'line') {
    const left = pending[owner]
    pending[owner] = []
    for (const p of left) clearTimeout(p.timer)
    const builds = ['reveal', 'walk']
    for (const p of left) if (builds.includes(p.action.kind)) run(p.action)
    const lastCamera = left.filter((p) => p.action.kind === 'camera').at(-1)
    if (lastCamera) run(lastCamera.action)
  }

  function showLine(index: number) {
    flush('line')
    line.value = index
    spotlight.value = null
    const shown = current.value?.lines[index]
    if (shown?.gesture) gestureNow(shown.gesture)
    schedule('line', shown?.cues)
  }

  /** Starts beat `index`, with the page revealed as the beats before it left it. */
  function enterBeat(index: number) {
    flush('line')
    flush('beat')
    beat.value = index
    revealed.value = new Set(TUTORIAL.slice(0, index).flatMap(revealsOf))
    const at = beatTiles.get(index)
    if (at !== undefined) place(at)
    else if (tile !== null) beatTiles.set(index, tile)
    saying = null
    inspecting.value = null
    shopTile.value = null
    spin.value = null
    schedule('beat', TUTORIAL[index]?.cues)
    showLine(0)
  }

  function next() {
    const lines = current.value?.lines.length ?? 0
    if (line.value < lines - 1) showLine(line.value + 1)
    else if (beat.value < TUTORIAL.length - 1) enterBeat(beat.value + 1)
    else finish()
  }

  function back() {
    if (line.value > 0) showLine(line.value - 1)
    else if (beat.value > 0) enterBeat(beat.value - 1)
  }

  const fadeTimers: ReturnType<typeof setTimeout>[] = []
  const clearFades = () => fadeTimers.splice(0).forEach(clearTimeout)

  /**
   * Fades the page to black, sets the title scene up under the black and fades it in, with the
   * music starting as it does. Browsers only play sound after a click: from "How to play" it starts
   * here, while a first visit opens by itself and has to wait for "Begin".
   */
  function start() {
    clearFades()
    flush('line')
    flush('beat')
    void loadAnimationInfo()
    const loaded = world.value ? Promise.resolve(world.value) : loadTutorialWorld()
    phase.value = 'fading'
    cover.value = true
    // Once the page is black and the world has loaded, the title scene is set up under the black,
    // which then lifts.
    const black = new Promise((done) => fadeTimers.push(setTimeout(done, TO_BLACK_MS)))
    void Promise.all([loaded, black]).then(([loadedWorld]) => {
      if (phase.value !== 'fading') return
      world.value = loadedWorld
      beatTiles.clear()
      revealed.value = new Set()
      place(tileId(TOUR_START))
      phase.value = 'title'
      run({ kind: 'camera', to: 'guide', zoom: TITLE_ZOOM, ms: 0 })
      const since = game.serverNow()
      gesture = { anim: GESTURE.wave, since, until: Infinity }
      music.play(music.NEWBIE_MELODY)
      fadeTimers.push(setTimeout(() => (cover.value = false), FROM_BLACK_MS))
    })
  }

  /** From the title scene into the tour: the title fades out, the map and chatbox fade in. */
  function begin() {
    if (phase.value !== 'title') return
    if (!music.isPlaying()) music.play(music.NEWBIE_MELODY)
    phase.value = 'playing'
    enterBeat(0)
  }

  /** Ends the tour, at the end or by skipping; either way it won't open by itself again. */
  function finish() {
    clearFades()
    cover.value = false
    flush('line')
    flush('beat')
    music.stop()
    phase.value = 'off'
    seen.value = true
    try {
      localStorage.setItem(SEEN_KEY, VERSION)
    } catch {
      // Shown again next visit.
    }
  }

  function toggleMute() {
    muted.value = !muted.value
    music.setMuted(muted.value)
  }

  return {
    seen,
    phase,
    cover,
    active,
    staged,
    beat,
    line,
    text,
    isFirst,
    isLast,
    revealed,
    camera,
    inspecting,
    spotlight,
    spin,
    shopTile,
    world,
    muted,
    guide,
    shows,
    start,
    begin,
    next,
    back,
    finish,
    toggleMute,
    endSpin: () => (spin.value = null),
    closeShop: () => (shopTile.value = null),
  }
})

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === VERSION
  } catch {
    return false
  }
}

/** Every part of the page a beat reveals, in its own cues and its lines'. */
function revealsOf(beat: (typeof TUTORIAL)[number]): RevealName[] {
  const cues = [...(beat.cues ?? []), ...beat.lines.flatMap((l) => l.cues ?? [])]
  return cues.flatMap((c) => (c.action.kind === 'reveal' ? c.action.what : []))
}
