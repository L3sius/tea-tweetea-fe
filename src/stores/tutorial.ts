import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef } from 'vue'
import { ticksToMs, type Performance } from '@/characters/acting'
import { animationInfoOf, loadAnimationInfo } from '@/characters/assets'
import { RUN_FROM_STEPS } from '@/characters/roster'
import type { Board } from '@/domain/board'
import type { GameEvent } from '@/domain/events'
import type { TileId } from '@/domain/ids'
import { Choreography, type Placement } from '@/domain/motion'
import { adjacency } from '@/domain/paths'
import { GUIDE, GUIDE_TEAM, LUMBRIDGE } from '@/tutorial/guide'
import * as music from '@/tutorial/music'
import { GESTURE, TUTORIAL, type Action, type Cue, type RevealName } from '@/tutorial/script'
import { useGameStore } from './game'

const SEEN_KEY = 'tweetea.tutorial'
/** Bump when the tutorial changes enough that everyone should see it again. */
const VERSION = '1'
/** How long an overhead line stays up, unless the script says. */
const SAY_MS = 2600
/** Assumed for a gesture whose length hasn't loaded. */
const GESTURE_MS = 2000

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
  const phase = ref<'off' | 'title' | 'playing'>('off')
  const beat = ref(0)
  const line = ref(0)
  const revealed = shallowRef<ReadonlySet<RevealName>>(new Set())
  const camera = shallowRef<CameraMove | null>(null)
  const muted = ref(music.isMuted())

  const active = computed(() => phase.value !== 'off')
  const current = computed(() => TUTORIAL[beat.value] ?? null)
  const text = computed(() => current.value?.lines[line.value]?.text ?? '')
  const isFirst = computed(() => beat.value === 0 && line.value === 0)
  const isLast = computed(
    () =>
      beat.value === TUTORIAL.length - 1 && line.value === (current.value?.lines.length ?? 1) - 1,
  )

  /** Whether a part of the page shows: everything does outside the tutorial. */
  const shows = (name: RevealName) => !active.value || revealed.value.has(name)

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

  /** Walks him `steps` steps along the roads, heading away from where he set off. */
  function walk(steps: number) {
    const board = game.board
    if (!board || tile === null) return
    const path = pathFrom(board, tile, steps)
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

  type Pending = { timer: ReturnType<typeof setTimeout>; action: Action }
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
        return walk(action.steps)
      case 'gesture':
        return gestureNow(action.gesture)
      case 'say':
        saying = { text: action.text, until: game.serverNow() + (action.ms ?? SAY_MS) }
    }
  }

  function schedule(owner: 'beat' | 'line', cues: readonly Cue[] = []) {
    for (const cue of cues) {
      const entry: Pending = {
        timer: setTimeout(() => {
          pending[owner] = pending[owner].filter((p) => p !== entry)
          run(cue.action)
        }, cue.at),
        action: cue.action,
      }
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
    for (const p of left) if (p.action.kind === 'reveal' || p.action.kind === 'walk') run(p.action)
    const lastCamera = left.filter((p) => p.action.kind === 'camera').at(-1)
    if (lastCamera) run(lastCamera.action)
  }

  function showLine(index: number) {
    flush('line')
    line.value = index
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

  /** Opens the title card; the tour itself waits for a click, which also lets the music start. */
  function start() {
    flush('line')
    flush('beat')
    beatTiles.clear()
    revealed.value = new Set()
    place(game.board ? startTile(game.board) : null)
    void loadAnimationInfo()
    phase.value = 'title'
  }

  function begin() {
    music.play(music.NEWBIE_MELODY)
    phase.value = 'playing'
    enterBeat(0)
  }

  /** Ends the tour, at the end or by skipping; either way it won't open by itself again. */
  function finish() {
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
    active,
    beat,
    line,
    text,
    isFirst,
    isLast,
    revealed,
    camera,
    muted,
    guide,
    shows,
    start,
    begin,
    next,
    back,
    finish,
    toggleMute,
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

/** The tile nearest Lumbridge. */
function startTile(board: Board): TileId | null {
  let best: TileId | null = null
  let bestDistance = Infinity
  for (const tile of board.tiles.values()) {
    const d = Math.hypot(tile.x - LUMBRIDGE.x, tile.y - LUMBRIDGE.y)
    if (tile.kind === 'normal' && d < bestDistance) {
      best = tile.id
      bestDistance = d
    }
  }
  return best
}

/**
 * A walk of up to `steps` steps along the roads from `from` that never doubles back: the longest
 * there is, ending as far from `from` as it can. Roads branch little, so every walk is tried.
 */
export function pathFrom(board: Board, from: TileId, steps: number): TileId[] {
  const roads = adjacency(board.roads)
  const origin = board.tiles.get(from)
  const away = (t: TileId) => {
    const at = board.tiles.get(t)
    return at && origin ? Math.hypot(at.x - origin.x, at.y - origin.y) : 0
  }
  let best = [from]
  const better = (path: TileId[]) =>
    path.length > best.length ||
    (path.length === best.length && away(path.at(-1) ?? from) > away(best.at(-1) ?? from))
  const walk = (path: TileId[]) => {
    if (better(path)) best = [...path]
    if (path.length > steps) return
    for (const next of roads.get(path.at(-1) ?? from) ?? []) {
      if (path.includes(next)) continue
      path.push(next)
      walk(path)
      path.pop()
    }
  }
  walk([from])
  return best
}
