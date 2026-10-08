<script setup lang="ts">
import {
  CRS,
  DomEvent,
  Transformation,
  Util,
  canvas,
  circleMarker,
  divIcon,
  imageOverlay,
  latLng,
  latLngBounds,
  layerGroup,
  map as createMap,
  marker,
  point,
  polyline,
  tooltip,
  type LatLng,
  type LatLngBounds,
  type LeafletMouseEvent,
  type Map as LeafletMap,
  type Marker,
  type ZoomAnimEvent,
} from 'leaflet'
import { h, onBeforeUnmount, onMounted, ref, render, useTemplateRef, watch } from 'vue'
import type { Board, Tile } from '@/domain/board'
import type { Challenge } from '@/domain/challenge'
import { blockerName, cardLabel, challengeProgress, clock, type Names } from '@/domain/describe'
import type { Blocker, Card, GameState, Team } from '@/domain/game'
import type { ChallengeId, TeamId, TileId } from '@/domain/ids'
import type { Choreography, Cue, Placement } from '@/domain/motion'
import type { Replay } from '@/domain/replay'
import { nearestTile, sharedLength, type WalkOptions } from '@/domain/paths'
import { perform, ticksToMs } from '@/characters/acting'
import { animationInfoOf, loadAnimationInfo } from '@/characters/assets'
import { HEADING, headingOf } from '@/characters/heading'
import type { Appearance } from '@/characters/roster'
import type * as Stage from '@/characters/stage'
import { characterElement, spriteElement } from '@/map/sprite'
import { itemEntry } from '@/domain/items'
import type { Item } from '@/domain/vocabulary'
import { tileTheme } from '@/map/tileTheme'
import { CRS_ORIGIN, imageBounds, terrainScene, tileCentre, worldMap } from '@/map/world'
import { TILE_COLORS, teamColor } from '@/ui/colors'
import { TtClickMarker } from '@/ui/tt'
import TileScene, { type TileView } from './TileScene.vue'

const props = defineProps<{
  board: Board
  state: GameState
  challenges: ReadonlyMap<ChallengeId, Challenge>
  names: Names
  choreography: Choreography
  serverNow: () => number
  selected: TeamId | null
  follow: boolean
  /** The team this browser manages; its route and targets are drawn in its colour. */
  myTeam: Team | null
  /** The walk being built, start tile first; null when the team isn't picking a walk. */
  route: readonly TileId[] | null
  /** Route lengths after each checkpoint, to mark the checkpoints. */
  checkpoints: readonly number[]
  /** The route a click on the hovered node would leave, start tile first. */
  preview: readonly TileId[] | null
  stepsLeft: number
  /** Where the next checkpoint can go. */
  options: WalkOptions | null
  targetTiles: ReadonlySet<TileId> | null
  /** Skip callouts for this team, whose captain is watching their draw in the panel. */
  hideCuesFor: TeamId | null
  /** A replay of past moves: the teams it moves are drawn from it instead of the live game. */
  replay?: Replay | null
  /** How a team's piece looks as an OSRS character, or null to draw it as a bird. */
  appearanceOf: (team: TeamId) => Appearance | null
}>()

const emit = defineEmits<{
  /** The pickable node under the pointer, or null when it leaves one. */
  hover: [tile: TileId | null]
  pick: [tile: TileId]
  /** The viewer dragged the map or went to the overview, which ends following. */
  freeRoam: []
  view: [bounds: { south: number; west: number; north: number; east: number }]
}>()

const container = useTemplateRef<HTMLDivElement>('container')
let leaflet: LeafletMap | null = null
/** The world map's edges, which the view never leaves. */
let mapBounds: LatLngBounds | null = null
let frame = 0

const pieces = layerGroup()
const reachLayer = layerGroup()
const routeLayer = layerGroup()
const cueLayer = layerGroup()
type TeamMarker = {
  marker: Marker
  el: HTMLElement
  pose: string
  /** The NPC the team plays as, or null for a bird. */
  npc: number | null
  /** Draws the character, once three.js has loaded. */
  piece: Stage.CharacterPiece | null
}
const teamMarkers = new Map<TeamId, TeamMarker>()
const cueMarkers = new Map<string, Marker>()

/**
 * How close, in screen pixels, the pointer must be to a node to hover or pick it. Nodes keep the
 * same pixel size at every zoom, so this always matches what is drawn; neighbouring tiles sit
 * about 46px apart at zoom 0, where the map goes when a walk starts.
 */
const PICK_RADIUS = 20

const BLOCKER_ICONS = { banana: '🍌', swarm: '🐝', snake: '🐍', web: '🕸️' } as const

/** Blockers with a kit sprite draw it; the rest fall back to their emoji. */
const blockerHtml = (kind: keyof typeof BLOCKER_ICONS) =>
  kind === 'banana' ? '<span class="tt-sprite tt-icon-banana"></span>' : BLOCKER_ICONS[kind]

/** The last click while picking: a yellow cross on a tile, red when it missed. */
const click = ref<{ x: number; y: number; key: number; color: 'yellow' | 'red' } | null>(null)

function tileLatLng(tile: TileId): LatLng | null {
  const found = props.board.tiles.get(tile)
  if (!found) return null
  const c = tileCentre(found.x, found.y)
  return latLng(c.lat, c.lng)
}

const tileGems = () => new Map([...props.state.gemTiles].map(([gem, tile]) => [tile, gem]))

/** Each blocker's item, for its picture, and what it does to whoever meets it. */
const BLOCKERS: Record<Blocker['kind'], { item: Item; text: (b: Blocker) => string }> = {
  banana: { item: 'banana', text: () => 'slips the next team over it back a tile, frozen.' },
  swarm: { item: 'harpie_bug_swarm', text: () => 'stops the next team that walks over it.' },
  snake: { item: 'snake_charmer', text: () => 'sends the next team to land here back 5 tiles.' },
  web: {
    item: 'wilderness_web',
    text: (b) => (b.kind === 'web' ? `blocks the way until ${clock(b.until)}.` : ''),
  },
}

/**
 * What is on a tile, for its tooltip scene: the task, a gem, a blocker, the teams standing there.
 * Rebuilt each time it is shown, so it is always current.
 */
function tileView(tile: Tile): TileView {
  const continent = props.board.continents.find((c) => c.gem === tile.continent)
  // Every tile has its task, the one a team landing here must complete to move on. The minigame
  // a red tile starts is drawn at random on landing, so the theme only tells of its coming.
  const challengeId = props.state.tileChallenges.get(tile.id)
  const challenge = challengeId ? props.challenges.get(challengeId) : undefined
  const blocker = props.state.blockers.get(tile.id)
  const teams = [...props.state.teams.values()]
    .filter((team) => team.position === tile.id)
    .map((team) => {
      const { status } = team
      const instance =
        status.kind === 'working' ? props.state.instances.get(status.instanceId) : undefined
      const progress =
        status.kind === 'working' && challenge
          ? challengeProgress(challenge, instance, team.id)
          : null
      return {
        name: team.name,
        colour: teamColor(team),
        done: progress?.done ?? null,
        needed: progress?.needed ?? null,
        finished: status.kind === 'ready' || status.kind === 'drawn',
      }
    })
  return {
    regionName: continent?.name ?? 'Uncharted lands',
    regionGem: continent?.gem ?? null,
    terrain: tile.sea ? null : terrainScene(tile),
    task: challenge ? { name: challenge.name, description: challenge.description } : null,
    gemHere: tileGems().get(tile.id) ?? null,
    blocker: blocker
      ? {
          name: blockerName(blocker),
          icon: itemEntry(BLOCKERS[blocker.kind].item).icon,
          text: BLOCKERS[blocker.kind].text(blocker),
          web: blocker.kind === 'web',
        }
      : null,
    teams,
  }
}

/** The tooltip's scene, drawn by Vue into an element Leaflet shows. */
const sceneRoot = document.createElement('div')

function drawScene(tile: Tile) {
  const continent = props.board.continents.find((c) => c.gem === tile.continent)
  render(
    h(TileScene, { theme: tileTheme(tile, continent?.name ?? ''), view: tileView(tile) }),
    sceneRoot,
  )
}

function drawBoard(map: LeafletMap) {
  // Roads: a black outline under a parchment line, as on the event site's board.
  const roads = props.board.roads.flatMap(([a, b]) => {
    const from = tileLatLng(a)
    const to = tileLatLng(b)
    return from && to ? [[from, to]] : []
  })
  polyline(roads, { color: '#000', weight: 5.5, opacity: 0.85, interactive: false }).addTo(map)
  polyline(roads, { color: '#c8b98a', weight: 2.5, opacity: 0.95, interactive: false }).addTo(map)
  for (const tile of props.board.tiles.values()) {
    const at = tileLatLng(tile.id)
    if (!at) continue
    if (tile.kind === 'shop') {
      marker(at, {
        icon: divIcon({
          className: 'shop-marker',
          html: '<span class="tt-sprite tt-icon-coins"></span>',
          iconSize: [34, 34],
        }),
        interactive: false,
      }).addTo(map)
      continue
    }
    circleMarker(at, {
      radius: tile.kind === 'red' ? 8 : 6,
      color: '#000',
      weight: 1.5,
      fillColor: TILE_COLORS[tile.kind],
      fillOpacity: 1,
      interactive: false,
    }).addTo(map)
  }
}

/** Gems and blockers: board pieces that change as the game goes on. */
function drawPieces() {
  pieces.clearLayers()
  for (const [gem, tile] of props.state.gemTiles) {
    const at = tileLatLng(tile)
    if (!at) continue
    marker(at, {
      icon: divIcon({
        className: '',
        html: `<div class="gem-marker tt-sprite tt-gem-${gem}" style="--gem:var(--gem-${gem}-glow)"></div>`,
        iconSize: [30, 33],
      }),
      zIndexOffset: 500,
      interactive: false,
    }).addTo(pieces)
  }
  for (const [tile, blocker] of props.state.blockers) {
    const at = tileLatLng(tile)
    if (!at) continue
    marker(at, {
      icon: divIcon({
        className: 'blocker-marker',
        html: blockerHtml(blocker.kind),
        iconSize: [28, 28],
      }),
      zIndexOffset: 400,
      interactive: false,
    }).addTo(pieces)
  }
}

/**
 * Highlights where an item can be placed, or the walk's next steps as yellow squares. Further
 * checkpoints and where the walk can finish are left for the player to work out.
 */
function drawReach() {
  reachLayer.clearLayers()
  if (props.targetTiles) {
    for (const tile of props.targetTiles) {
      const at = tileLatLng(tile)
      if (at)
        circleMarker(at, {
          radius: 6,
          color: '#ff981f',
          weight: 2,
          fillOpacity: 0.15,
          interactive: false,
        }).addTo(reachLayer)
    }
    return
  }
  const options = props.options
  if (!options) return
  for (const tile of options.near) {
    const at = tileLatLng(tile)
    if (!at) continue
    marker(at, {
      icon: divIcon({ className: '', html: '<div class="dest-ring"></div>', iconSize: [20, 20] }),
      interactive: false,
      zIndexOffset: 800,
    }).addTo(reachLayer)
  }
}

const toPoints = (tiles: readonly TileId[]) =>
  tiles.map(tileLatLng).filter((p): p is LatLng => p !== null)

/** A square on the map holding a number: the steps still to walk. */
function counter(at: LatLng, text: string, color: string, ghost = false) {
  return marker(at, {
    icon: divIcon({
      className: '',
      html: `<div class="route-end${ghost ? ' ghost' : ''}" style="--team:${color}">${text}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 40],
    }),
    interactive: false,
    // Above the team pieces (1000), which sit on the start tile.
    zIndexOffset: ghost ? 1600 : 1500,
  })
}

/**
 * The walk being built: a solid line through the checkpoints so far, the stretch a click would add
 * as a dashed preview, and the steps left in a square over the end of each.
 */
function drawRoute() {
  routeLayer.clearLayers()
  const route = props.route
  if (!route) return
  const color = props.myTeam ? teamColor(props.myTeam) : '#ffff00'
  const points = toPoints(route)
  if (points.length >= 2) {
    polyline(points, { color: '#000', weight: 11, opacity: 0.75, interactive: false }).addTo(
      routeLayer,
    )
    polyline(points, { color, weight: 7, interactive: false }).addTo(routeLayer)
  }
  for (const n of props.checkpoints) {
    const tile = route[n - 1]
    const at = tile === undefined ? null : tileLatLng(tile)
    if (at)
      marker(at, {
        icon: divIcon({
          className: '',
          html: '<div class="checkpoint"></div>',
          iconSize: [14, 14],
        }),
        interactive: false,
        zIndexOffset: 850,
      }).addTo(routeLayer)
  }
  const preview = props.preview
  const end = points.at(-1)
  if (preview) {
    const kept = sharedLength(route, preview)
    const dropped = toPoints(route.slice(kept - 1))
    if (dropped.length >= 2)
      polyline(dropped, { color: '#000', weight: 8, opacity: 0.7, interactive: false }).addTo(
        routeLayer,
      )
    const ghost = toPoints(preview.slice(kept - 1))
    if (ghost.length >= 2) {
      polyline(ghost, { color: '#000', weight: 9, opacity: 0.5, interactive: false }).addTo(
        routeLayer,
      )
      polyline(ghost, {
        color,
        weight: 5,
        dashArray: '6 6',
        className: 'route-line',
        interactive: false,
      }).addTo(routeLayer)
    }
    const tip = ghost.at(-1)
    const left = props.stepsLeft + route.length - preview.length
    if (tip) counter(tip, String(left), color, true).addTo(routeLayer)
  }
  if (end) counter(end, String(props.stepsLeft), color).addTo(routeLayer)
}

/**
 * Tiles the pointer can pick: item targets, the next checkpoints, the route (to walk back along
 * it), or tiles reached by walking back first.
 */
function pickable(): Iterable<TileId> | null {
  if (props.targetTiles) return props.targetTiles
  const o = props.options
  if (o) return [...o.near, ...o.far, ...o.reroute, ...(props.route ?? [])]
  return null
}

/**
 * A click while picking: the nearest pickable node within reach. Otherwise it shows what is on
 * the nearest node, for touch screens that can't hover.
 */
function onClick(e: LeafletMouseEvent) {
  if (!pickable()) return showInfo(tileNear(e, props.board.tiles.keys()))
  const tile = tileUnder(e)
  const { x, y } = e.containerPoint
  click.value = { x, y, key: Date.now(), color: tile === null ? 'red' : 'yellow' }
  showInfo(tile)
  if (tile !== null) emit('pick', tile)
}

function tileUnder(e: LeafletMouseEvent): TileId | null {
  const candidates = pickable()
  return candidates ? tileNear(e, candidates) : null
}

/** The nearest of `candidates` within reach of the pointer. */
function tileNear(e: LeafletMouseEvent, candidates: Iterable<TileId>): TileId | null {
  if (!leaflet) return null
  const map = leaflet
  const position = (tile: TileId) => {
    const at = tileLatLng(tile)
    return at ? map.latLngToContainerPoint(at) : null
  }
  const tile = nearestTile(candidates, position, e.containerPoint)
  const at = tile === null ? null : position(tile)
  if (!at || at.distanceTo(e.containerPoint) > PICK_RADIUS) return null
  return tile
}

/** The node whose contents the tooltip shows, so it is only rebuilt when that changes. */
let infoTile: TileId | null = null
const infoTip = tooltip({ direction: 'top', offset: [0, -10], className: 'tile-tip', opacity: 1 })

function showInfo(tile: TileId | null, refresh = false) {
  if (tile === infoTile && !refresh) return
  infoTile = tile
  const at = tile === null ? null : tileLatLng(tile)
  if (!leaflet || tile === null || !at) return void infoTip.remove()
  // Clear of what marks the tile: the shop's coins stand taller than a node.
  const lift = props.board.tiles.get(tile)?.kind === 'shop' ? 22 : 10
  infoTip.options.direction = 'top'
  infoTip.options.offset = point(0, -lift)
  const info = props.board.tiles.get(tile)
  if (!info) return void infoTip.remove()
  drawScene(info)
  infoTip.setLatLng(at).setContent(sceneRoot)
  if (!leaflet.hasLayer(infoTip)) infoTip.addTo(leaflet)
  // Near the top edge it would run under the standings strip, so it hangs below the node instead.
  const height = infoTip.getElement()?.offsetHeight ?? 0
  if (leaflet.latLngToContainerPoint(at).y - lift - height < TIP_TOP_CLEARANCE) {
    infoTip.options.direction = 'bottom'
    infoTip.options.offset = point(0, lift)
    infoTip.update()
  }
}

/** Room the standings strip takes along the top of the map, plus the tooltip's pointer. */
const TIP_TOP_CLEARANCE = 76

// --- Team pieces, animated every frame from the choreography. ---

/** Canvas size of a character piece; the bird is 32 × 38. */
const CHARACTER_SIZE = { width: 60, height: 80 }
/**
 * The zoom a followed team is shown at. Characters keep their size up to here and grow with the map
 * past it, so zooming in never leaves them small next to the board (about 2.8× at full zoom).
 */
const PIECE_FULL_ZOOM = 0.5
const pieceScale = (zoom: number) => Math.max(1, 2 ** (zoom - PIECE_FULL_ZOOM))
/** How far above the feet a card beside a character starts: its middle at the body's middle. */
const CARD_BESIDE_LIFT = 59

// three.js is big, so it only loads once some team plays as a character.
let stage: Promise<typeof Stage> | null = null
const loadStage = () => (stage ??= import('@/characters/stage'))

function ensureTeamMarker(map: LeafletMap, team: Team) {
  const npc = props.appearanceOf(team.id)?.npc ?? null
  let entry = teamMarkers.get(team.id)
  if (entry && entry.npc === npc) return entry
  // New, or the team changed character: rebuild the piece.
  if (entry) {
    entry.marker.remove()
    entry.piece?.dispose()
  }
  const canvas = document.createElement('canvas')
  canvas.width = CHARACTER_SIZE.width
  // The body box leaves 4px at the bottom for the shadow.
  canvas.height = CHARACTER_SIZE.height - 4
  const el =
    npc !== null
      ? characterElement(canvas, teamColor(team), team.name)
      : spriteElement(teamColor(team), team.name)
  const [width, height] = npc !== null ? [CHARACTER_SIZE.width, CHARACTER_SIZE.height] : [32, 38]
  const m = marker(latLng(0, 0), {
    icon: divIcon({
      className: 'sprite-icon',
      html: el,
      iconSize: [width, height],
      iconAnchor: [width / 2, height - 4],
    }),
    zIndexOffset: 1000,
    // Clicks go through to the node underneath, so a piece never hides its tile. Teams are
    // followed from the standings and the inset map instead.
    interactive: false,
  })
  m.addTo(map)
  const created: TeamMarker = { marker: m, el, pose: '', npc, piece: null }
  if (npc !== null) {
    void loadAnimationInfo()
    void loadStage().then(({ CharacterPiece }) => {
      if (teamMarkers.get(team.id) === created) created.piece = new CharacterPiece(npc, canvas)
    })
  }
  entry = created
  teamMarkers.set(team.id, entry)
  return entry
}

/** Where to draw a placement, and how far its move goes east (`dx`) and north (`dy`). */
function placementLatLng(p: Placement): { at: LatLng; dx: number; dy: number } | null {
  if (p.kind === 'still') {
    const at = tileLatLng(p.tile)
    return at ? { at, dx: 0, dy: 0 } : null
  }
  const from = tileLatLng(p.from)
  const to = tileLatLng(p.to)
  if (!from || !to) return null
  if (p.kind === 'teleport') return { at: p.progress < 0.5 ? from : to, dx: 0, dy: 0 }
  const k = p.kind === 'slide' ? easeOut(p.progress) : p.progress
  return {
    at: latLng(from.lat + (to.lat - from.lat) * k, from.lng + (to.lng - from.lng) * k),
    dx: to.lng - from.lng,
    dy: to.lat - from.lat,
  }
}

const easeOut = (k: number) => 1 - (1 - k) ** 3

/** Last horizontal direction each team walked, so idle pieces keep facing the same way. */
const facing = new Map<TeamId, number>()
/** Which way each team last walked, for characters (see characters/heading.ts). */
const walkHeading = new Map<TeamId, number>()
const placed = new Map<TeamId, LatLng>()
let lastPrune = 0

/**
 * Where to draw a team at `time`: from a replay that moves it, staying where the replay left it
 * until the replay ends, else from the live game.
 */
function placementOf(team: TeamId, time: number): Placement | null {
  const replay = props.replay
  if (!replay?.teams.has(team)) return props.choreography.placement(team, time)
  const p = replay.choreography.placement(team, time)
  const tile = replay.choreography.finalTile(team)
  return p ?? (tile === null ? null : { kind: 'still', tile })
}

/** Where a team's movements come from: a replay that moves it, else the live game. */
function choreographyOf(team: TeamId): Choreography {
  const replay = props.replay
  return replay?.teams.has(team) ? replay.choreography : props.choreography
}

/** Draws a team's character doing whatever it is doing at `time` (see characters/acting.ts). */
function drawCharacter(
  piece: Stage.CharacterPiece,
  team: Team,
  p: Placement,
  time: number,
  still: ReadonlyMap<TileId, readonly TeamId[]>,
) {
  const appearance = props.appearanceOf(team.id)
  if (!appearance) return
  const frozenUntil = team.frozenUntil?.getTime() ?? null
  const performance = perform({
    team: team.id,
    time,
    placement: p,
    appearance,
    frozenUntil: frozenUntil !== null && frozenUntil > time ? frozenUntil : null,
    reactions: choreographyOf(team.id).reactionsOf(team.id, time),
    isSea: (tile) => props.board.tiles.get(tile)?.sea ?? false,
    isOccupied: (tile) => (still.get(tile) ?? []).some((other) => other !== team.id),
    lengthOf: (anim) => {
      const info = animationInfoOf(anim)
      return info ? ticksToMs(info.ticks) : null
    },
  })
  // Characters face the way they walk (a trap knocks them back facing the same way), and turn
  // to the viewer once they stop.
  const heading =
    p.kind === 'walk' || p.kind === 'slide'
      ? (walkHeading.get(team.id) ?? HEADING.south)
      : HEADING.south
  piece.draw(performance, heading, time)
}

function renderFrame() {
  frame = requestAnimationFrame(renderFrame)
  const map = leaflet
  if (!map) return
  const time = props.serverNow()
  const now = new Date(time)
  if (time - lastPrune > 5_000) {
    props.choreography.prune(time)
    lastPrune = time
  }

  // Teams standing still on the same tile fan out side by side.
  const still = new Map<TileId, TeamId[]>()
  const placements = new Map<TeamId, Placement | null>()
  for (const team of props.state.teams.values()) {
    const p = placementOf(team.id, time)
    placements.set(team.id, p)
    const tile = p === null ? team.position : p.kind === 'still' ? p.tile : null
    if (tile !== null) still.set(tile, [...(still.get(tile) ?? []), team.id])
  }

  for (const team of props.state.teams.values()) {
    const entry = ensureTeamMarker(map, team)
    const p = placements.get(team.id) ?? { kind: 'still' as const, tile: team.position }
    const where = placementLatLng(p)
    if (!where) continue
    entry.marker.setLatLng(where.at)
    placed.set(team.id, where.at)
    if (where.dx !== 0) facing.set(team.id, Math.sign(where.dx))
    if (p.kind === 'walk' && (where.dx !== 0 || where.dy !== 0))
      walkHeading.set(team.id, headingOf(where.dx, where.dy))

    const frozen = team.frozenUntil !== null && team.frozenUntil > now
    const pose =
      p.kind === 'walk'
        ? 'walking'
        : p.kind === 'slide'
          ? 'sliding'
          : p.kind === 'teleport'
            ? p.progress < 0.5
              ? 'teleport-out'
              : 'teleport-in'
            : frozen
              ? 'frozen'
              : team.matchId !== null
                ? 'fighting'
                : 'idle'
    const group = p.kind === 'still' ? still.get(p.tile) : undefined
    const slot = group ? group.indexOf(team.id) - (group.length - 1) / 2 : 0
    if (entry.piece) drawCharacter(entry.piece, team, p, time, still)
    const key = `${pose}|${facing.get(team.id) ?? 1}|${slot}|${props.selected === team.id}`
    if (key !== entry.pose) {
      entry.pose = key
      const kind = entry.npc !== null ? ' sprite-character' : ''
      entry.el.className = `sprite${kind} sprite-${pose}${props.selected === team.id ? ' sprite-selected' : ''}`
      entry.el.style.setProperty('--facing', String(facing.get(team.id) ?? 1))
      entry.el.style.setProperty('--slot', String(slot))
    }
  }

  // Callouts float above the piece they belong to. A replayed team's callouts come from the
  // replay (its live ones wait), and they are not hidden from its own captain.
  const replay = props.replay
  const active: Cue[] = [
    ...props.choreography
      .activeCues(time)
      .filter((c) => !replay?.teams.has(c.teamId) && c.teamId !== props.hideCuesFor),
    ...(replay?.choreography.activeCues(time) ?? []).map((c) => ({ ...c, id: `replay-${c.id}` })),
  ]
  const live = new Set(active.map((c) => c.id))
  for (const [id, m] of cueMarkers) {
    if (!live.has(id)) {
      cueLayer.removeLayer(m)
      cueMarkers.delete(id)
    }
  }
  for (const cue of active) {
    const at = placed.get(cue.teamId)
    if (!at) continue
    let m = cueMarkers.get(cue.id)
    if (!m) {
      const el = cue.card ? cardCue(cue.card) : document.createElement('div')
      if (!cue.card) {
        el.className = `cue cue-${cue.tone}`
        el.textContent = cue.text
      }
      const character = teamMarkers.get(cue.teamId)?.npc != null
      // A character's drawn card goes beside it, level with its body, so it never hides the
      // character's reaction to it (a Joker makes it cry). Other callouts go over its head.
      const beside = character && cue.card !== undefined
      const lift = beside ? CARD_BESIDE_LIFT : character ? CHARACTER_SIZE.height + 4 : 46
      const placement = beside ? ' cue-beside-character' : character ? ' cue-over-character' : ''
      m = marker(at, {
        icon: divIcon({
          className: `cue-icon${placement}`,
          html: el,
          iconSize: [0, 0],
          iconAnchor: [0, lift],
        }),
        interactive: false,
        zIndexOffset: 2000,
      }).addTo(cueLayer)
      cueMarkers.set(cue.id, m)
    } else m.setLatLng(at)
  }

  // Follow camera: ease towards the selected team instead of jumping. It waits out a flight, since
  // moving the view would cut the flight short, and a zoom, which it would make jerk.
  if (props.follow && props.selected !== null && !flying && !zooming) {
    const target = placed.get(props.selected)
    if (target) followStep(map, target)
  }
}

/** Share of the way to the followed team the camera moves each frame. */
const FOLLOW_EASE = 0.12

/**
 * Moves the view a step towards `target`, in whole pixels, as Leaflet pans. It aims for the
 * nearest centre the map's edges allow and stops within a pixel of it: every move redraws the
 * roads and reports the view, so a camera that keeps nudging at an edge or at a pixel's fraction
 * would do that every frame.
 */
function followStep(map: LeafletMap, target: LatLng) {
  const zoom = map.getZoom()
  const half = map.getSize().divideBy(2)
  const want = map.project(target, zoom)
  if (mapBounds) {
    const a = map.project(mapBounds.getNorthWest(), zoom)
    const b = map.project(mapBounds.getSouthEast(), zoom)
    want.x = clampCentre(want.x, Math.min(a.x, b.x) + half.x, Math.max(a.x, b.x) - half.x)
    want.y = clampCentre(want.y, Math.min(a.y, b.y) + half.y, Math.max(a.y, b.y) - half.y)
  }
  const gap = want.subtract(map.project(map.getCenter(), zoom))
  const step = point(stepToward(gap.x), stepToward(gap.y))
  if (step.x !== 0 || step.y !== 0) map.panBy(step, { animate: false })
}

/** Within `[lo, hi]`, or between them when the view is wider than the map. */
const clampCentre = (v: number, lo: number, hi: number) =>
  lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v))

/** An eased step in whole pixels: at least one while a pixel or more is left, then none. */
const stepToward = (gap: number) =>
  Math.abs(gap) < 1 ? 0 : Math.sign(gap) * Math.max(1, Math.round(Math.abs(gap) * FOLLOW_EASE))

/** A small card that flips over above the piece: what spectators see of a draw. */
function cardCue(card: Card): HTMLElement {
  const el = document.createElement('div')
  const red = card.kind === 'suited' && (card.suit === 'hearts' || card.suit === 'diamonds')
  el.className = `cue-card${red ? ' red' : ''}`
  el.innerHTML =
    '<span class="mini"><span class="mini-back"></span><span class="mini-face"></span></span>'
  const face = el.querySelector('.mini-face')
  if (face) face.textContent = card.kind === 'joker' ? '🃏' : cardLabel(card)
  return el
}

function emitView() {
  const b = leaflet?.getBounds()
  if (b)
    emit('view', { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() })
}

onMounted(() => {
  if (!container.value) return
  const crs = Util.extend({}, CRS.Simple, {
    transformation: new Transformation(1, -CRS_ORIGIN.x, -1, CRS_ORIGIN.y),
  })
  const bounds = latLngBounds(imageBounds(worldMap))
  mapBounds = bounds
  const map = createMap(container.value, {
    crs,
    minZoom: -3,
    // The pixel-art map only: past zoom 2 one of its pixels would cover more than 8 screen pixels.
    maxZoom: 2,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 90,
    maxBounds: bounds,
    maxBoundsViscosity: 1,
    attributionControl: false,
    zoomControl: false,
    // Roads and nodes go on one canvas, redrawn only when a drag ends. Leaflet's default margin
    // around the view (10%) ran out within a short drag and showed bare map until the redraw;
    // half a view each way covers a normal drag.
    renderer: canvas({ padding: 0.5 }),
  })
  // Always the pixel-art map; the board is drawn over it at fixed pixel sizes.
  imageOverlay(worldMap.imageUrl, bounds, { className: 'pixel-map', pane: 'tilePane' }).addTo(map)

  // The map always fills the view: zooming out stops where it just covers it, and panning stops at
  // its edges, so no background ever shows. Fully zoomed out it centres itself, as "All" does.
  const fillView = () => map.setMinZoom(map.getBoundsZoom(bounds, true))
  fillView()
  map.on('resize', fillView)
  map.setView(bounds.getCenter(), map.getMinZoom())
  // Only zooming out lands in the overview; a flight to a team never does. Every wheel tick stops
  // a running glide, even at full zoom-out, so the overview waits until the wheel is quiet, and
  // scrolling out further there brings it back if a tick cut it short.
  const atMin = () => map.getZoom() <= map.getMinZoom() + 0.001
  let overviewTimer: ReturnType<typeof setTimeout> | undefined
  const overviewSoon = () => {
    clearTimeout(overviewTimer)
    overviewTimer = setTimeout(() => atMin() && showAll(), OVERVIEW_QUIET_MS)
  }
  let zoomedFrom = map.getZoom()
  // Characters grow with the map when zoomed in close (see PIECE_FULL_ZOOM): at the start of an
  // animated zoom, so they grow along with it, and on every other zoom change.
  const scalePieces = (zoom: number) =>
    map.getContainer().style.setProperty('--piece-scale', String(pieceScale(zoom)))
  map.on('zoomanim', (e: ZoomAnimEvent) => scalePieces(e.zoom))
  map.on('zoom', () => scalePieces(map.getZoom()))
  scalePieces(map.getZoom())
  map.on('zoomstart', () => {
    zoomedFrom = map.getZoom()
    zooming = true
  })
  map.on('zoomend', () => {
    zooming = false
    if (!flying && atMin() && zoomedFrom > map.getZoom()) overviewSoon()
  })
  container.value.addEventListener(
    'wheel',
    (e) => {
      stopFlight()
      if (e.deltaY > 0 && atMin()) overviewSoon()
    },
    { passive: true },
  )
  drawBoard(map)
  reachLayer.addTo(map)
  routeLayer.addTo(map)
  pieces.addTo(map)
  cueLayer.addTo(map)
  drawPieces()
  drawReach()
  drawRoute()

  map.on('dragstart', () => {
    stopFlight()
    emit('freeRoam')
  })
  map.on('moveend zoomend', emitView)
  // Hover reports only changes, and null as soon as the pointer is off every node.
  let hovered: TileId | null = null
  const hover = (tile: TileId | null) => {
    if (tile === hovered) return
    hovered = tile
    emit('hover', tile)
  }
  map.on('mousemove', (e: LeafletMouseEvent) => {
    const tile = tileUnder(e)
    hover(tile)
    map.getContainer().style.cursor = tile === null ? '' : 'pointer'
    showInfo(tile ?? tileNear(e, props.board.tiles.keys()))
  })
  map.on('mouseout', () => {
    hover(null)
    showInfo(null)
  })
  map.on('click', onClick)
  DomEvent.disableScrollPropagation(container.value)
  leaflet = map
  zoomAroundCentre(props.follow)
  emitView()
  frame = requestAnimationFrame(renderFrame)
})

watch(
  () => props.state,
  () => {
    drawPieces()
    if (infoTile !== null) showInfo(infoTile, true)
  },
)
watch(() => [props.options, props.targetTiles, props.myTeam?.id], drawReach)
watch(
  () => [props.route, props.preview, props.checkpoints, props.stepsLeft, props.myTeam?.id],
  drawRoute,
)
watch(
  () => props.selected,
  () => {
    for (const entry of teamMarkers.values()) entry.pose = ''
  },
)
watch(() => props.follow, zoomAroundCentre)

/**
 * While following, the wheel, a double click and a pinch zoom on the centre, where the team is,
 * instead of on the pointer. Zooming on the pointer carried the team off centre and the camera
 * then dragged it back, swinging the view.
 */
function zoomAroundCentre(following: boolean) {
  const options = leaflet?.options
  if (!options) return
  const on = following ? 'center' : true
  options.scrollWheelZoom = on
  options.doubleClickZoom = on
  options.touchZoom = on
}

onBeforeUnmount(() => {
  stopFlight()
  render(null, sceneRoot)
  cancelAnimationFrame(frame)
  for (const entry of teamMarkers.values()) entry.piece?.dispose()
  teamMarkers.clear()
  cueMarkers.clear()
  leaflet?.remove()
  leaflet = null
})

/** How long the wheel must rest before zooming out all the way glides to the overview. */
const OVERVIEW_QUIET_MS = 200

/** How far past the full zoom-out a flight to a tile goes at least, so the piece reads clearly. */
const LOCATE_ZOOM_IN = 1.5

/** Pans and zooms to a tile, never zooming out. */
function locate(tile: TileId, zoom = 1) {
  const map = leaflet
  const at = tileLatLng(tile)
  if (!map || !at) return
  const target = Math.max(zoom, map.getMinZoom() + LOCATE_ZOOM_IN, map.getZoom())
  fly(map, at, Math.min(target, map.getMaxZoom()))
}

/**
 * A flight is on: the follow camera holds off, and its zoom changes are not the viewer zooming out.
 */
let flying = false
/** A zoom animation is running; the follow camera waits for it. */
let zooming = false
let flight = 0

const FLIGHT_MS = 800

/**
 * Glides the view to `at` at `zoom`, centre and zoom eased together a frame at a time through
 * `setView`, so the map's limits hold the whole way. Leaflet's own `flyTo` dips out below the full
 * zoom-out on a long flight and ignores the map's edges until it lands, which showed the black
 * background around the map (worst when flying to a team at the edge right after loading). A drag,
 * a wheel tick or a zoom button stops it where it is.
 */
function fly(map: LeafletMap, at: LatLng, zoom: number) {
  stopFlight()
  const from = map.getCenter()
  const z0 = map.getZoom()
  const z1 = Math.min(Math.max(zoom, map.getMinZoom()), map.getMaxZoom())
  // Zoom snapping would turn the eased zoom into visible steps; it comes back when the flight ends.
  const snap = map.options.zoomSnap
  map.options.zoomSnap = 0
  const start = performance.now()
  flying = true
  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / FLIGHT_MS)
    const e = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
    const centre = latLng(from.lat + (at.lat - from.lat) * e, from.lng + (at.lng - from.lng) * e)
    map.setView(centre, z0 + (z1 - z0) * e, { animate: false })
    if (t < 1) flight = requestAnimationFrame(frame)
    else stopFlight()
  }
  flight = requestAnimationFrame(frame)
  restoreSnap = () => (map.options.zoomSnap = snap)
}

let restoreSnap = () => {}

function stopFlight() {
  if (flight) cancelAnimationFrame(flight)
  flight = 0
  flying = false
  restoreSnap()
  restoreSnap = () => {}
}

/** Pans to a world position without changing zoom. */
function panTo(lat: number, lng: number) {
  leaflet?.panTo(latLng(lat, lng))
}

function zoomBy(delta: number) {
  stopFlight()
  leaflet?.setZoom(leaflet.getZoom() + delta)
}

/**
 * The overview: fully zoomed out and centred, from "All" or from zooming out as far as it goes. It
 * ends following, which would otherwise pull the view off centre again.
 */
function showAll() {
  const map = leaflet
  if (!map) return
  const centre = latLngBounds(imageBounds(worldMap)).getCenter()
  const off = map.latLngToContainerPoint(centre).distanceTo(map.getSize().divideBy(2))
  if (off < 2 && map.getZoom() <= map.getMinZoom() + 0.001) return
  emit('freeRoam')
  fly(map, centre, map.getMinZoom())
}

defineExpose({ locate, panTo, zoomBy, showAll })
</script>

<template>
  <div class="relative size-full">
    <div ref="container" class="board-map size-full" aria-label="Board map" role="application" />
    <TtClickMarker
      v-if="click"
      class="z-[900]"
      :color="click.color"
      :x="click.x"
      :y="click.y"
      :play-key="click.key"
      @done="click = null"
    />
  </div>
</template>

<style>
.board-map {
  background: #000;
  font: inherit;
}
.board-map .pixel-map {
  image-rendering: pixelated;
}
/* The tile tooltip is all scene (TileScene draws its own frame): no box, no pointer. */
.board-map .leaflet-tooltip.tile-tip {
  padding: 0;
  border: 0;
  background: none;
  box-shadow: none;
  white-space: normal;
}
.board-map .leaflet-tooltip.tile-tip::before {
  display: none;
}
/* Gems, shops and blockers are landmarks: half again the size of their sprites, over the nodes. */
.board-map .gem-marker {
  width: 30px;
  height: 33px;
  filter: drop-shadow(1px 1px 0 #000) drop-shadow(0 0 4px var(--gem));
  animation: gem-glint 2.4s steps(2, end) infinite;
}
@keyframes gem-glint {
  50% {
    filter: drop-shadow(1px 1px 0 #000) drop-shadow(0 0 8px var(--gem)) brightness(1.3);
    transform: translateY(-2px);
  }
}
.board-map .shop-marker span {
  display: block;
  width: 34px;
  height: 34px;
  filter: drop-shadow(1px 1px 0 #000);
}
.board-map .blocker-marker {
  font-size: 24px;
  line-height: 28px;
  text-align: center;
  filter: drop-shadow(1px 1px 0 #000);
}
.board-map .blocker-marker .tt-sprite {
  width: 28px;
  height: 28px;
}
/* Where a walk can end: yellow squares with a glow, as on the event site. */
.board-map .dest-ring {
  width: 20px;
  height: 20px;
  box-sizing: border-box;
  border: 3px solid var(--osrs-yellow);
  box-shadow:
    0 0 0 1px #000,
    0 0 6px var(--osrs-yellow);
  animation: dest-pulse 1.2s steps(3, end) infinite;
}
@keyframes dest-pulse {
  50% {
    transform: scale(1.25);
    opacity: 0.6;
  }
}
.board-map .route-line {
  animation: route-march 0.8s linear infinite;
}
@keyframes route-march {
  to {
    stroke-dashoffset: -14;
  }
}
/* Steps left, in a square floating over the end of the route. */
.board-map .route-end {
  display: grid;
  width: 28px;
  height: 28px;
  box-sizing: border-box;
  place-items: center;
  border: 3px solid #000;
  background: var(--team);
  box-shadow: 3px 3px 0 #000;
  color: #000;
  font-family: var(--font-bold);
  font-size: 16px;
}
/* The same square over the end of the hover preview: what would be left after that click. */
.board-map .route-end.ghost {
  background: var(--tooltip-bg);
  color: var(--osrs-yellow);
  text-shadow: 1px 1px 0 #000;
  opacity: 0.9;
}
.board-map .checkpoint {
  width: 14px;
  height: 14px;
  box-sizing: border-box;
  border: 3px solid #000;
  background: var(--osrs-white);
}

/* Team pieces: clicks pass through to the node underneath. */
.board-map .sprite-icon {
  pointer-events: none;
}
.board-map .sprite {
  position: relative;
  width: 32px;
  height: 38px;
  transform: translateX(calc(var(--slot, 0) * 20px));
  transition: transform 0.3s;
}
.board-map .sprite-body {
  position: absolute;
  inset: 0 0 4px;
  transform: scaleX(var(--facing, 1));
}
.board-map .sprite-body svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 1px 0 #0f172a);
}
.board-map .sprite-shadow {
  position: absolute;
  bottom: 2px;
  left: 6px;
  width: 20px;
  height: 6px;
  background: rgb(0 0 0 / 0.45);
}
/* Team names float under the piece like OSRS overhead text: team colour, hard shadow. */
.board-map .sprite-label {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  color: var(--team);
  font-family: var(--font-bold);
  font-size: var(--fs-1);
  line-height: 1;
  text-shadow: 1px 1px 0 #000;
  white-space: nowrap;
}
.board-map .sprite .feet-b {
  display: none;
}
.board-map .sprite-idle .sprite-body svg {
  animation: sprite-bob 1.6s ease-in-out infinite;
}
@keyframes sprite-bob {
  50% {
    transform: translateY(-2px);
  }
}
.board-map .sprite-walking .sprite-body svg {
  animation: sprite-hop 0.21s ease-in-out infinite alternate;
}
.board-map .sprite-walking .feet-a {
  animation: feet-swap 0.21s steps(1) infinite;
}
.board-map .sprite-walking .feet-b {
  display: inline;
  animation: feet-swap 0.21s steps(1) infinite reverse;
}
@keyframes sprite-hop {
  to {
    transform: translateY(-3px);
  }
}
@keyframes feet-swap {
  50% {
    opacity: 0;
  }
}
.board-map .sprite-sliding .sprite-body {
  animation: sprite-spin 0.65s ease-out;
}
@keyframes sprite-spin {
  to {
    transform: rotate(360deg);
  }
}
.board-map .sprite-teleport-out .sprite-body {
  animation: tp-out 0.55s ease-in forwards;
}
.board-map .sprite-teleport-in .sprite-body {
  animation: tp-in 0.55s ease-out;
}
/* A character arrives with its own landing animation, which starts out of sight. It stays hidden
   while a bird would flash in, so it does not arrive twice. */
.board-map .sprite-character.sprite-teleport-in .sprite-body,
.board-map .sprite-character.sprite-teleport-in .sprite-shadow {
  animation: none;
  opacity: 0;
}
@keyframes tp-out {
  to {
    transform: scale(0.1, 2.4) translateY(-14px);
    opacity: 0;
    filter: brightness(3);
  }
}
@keyframes tp-in {
  from {
    transform: scale(0.1, 2.4) translateY(-14px);
    opacity: 0;
    filter: brightness(3);
  }
}
.board-map .sprite-frozen .sprite-body {
  filter: saturate(0.3) hue-rotate(160deg) brightness(1.2);
}
.board-map .sprite-frozen .sprite-body::after {
  content: '❄';
  position: absolute;
  top: -8px;
  right: -6px;
  font-size: 14px;
}
.board-map .sprite-fighting .sprite-body svg {
  animation: sprite-shake 0.5s ease-in-out infinite;
}
@keyframes sprite-shake {
  25% {
    transform: translateX(-1.5px) rotate(-6deg);
  }
  75% {
    transform: translateX(1.5px) rotate(6deg);
  }
}
.board-map .sprite-character {
  width: 60px;
  height: 80px;
  transform: translateX(calc(var(--slot, 0) * 30px * var(--piece-scale, 1)));
}
/* Zoomed in close, the character and its shadow grow from the feet up, as the map does. */
.board-map .sprite-character .sprite-body,
.board-map .sprite-character .sprite-shadow {
  scale: var(--piece-scale, 1);
  transform-origin: 50% 100%;
  transition: scale 0.25s;
}
/* Callouts over a grown character rise with its head. */
.board-map .cue-over-character > * {
  translate: 0 calc((1 - var(--piece-scale, 1)) * 76px);
}
/* A drawn card stands to the right of the character, level with its body, as the character grows. */
.board-map .cue-beside-character > * {
  translate: calc(var(--piece-scale, 1) * 34px) calc((1 - var(--piece-scale, 1)) * 38px);
}
/* A character turns in 3D instead of mirroring, and animates itself instead of hopping. */
.board-map .sprite-character .sprite-body {
  transform: none;
}
.board-map .sprite-character .sprite-body canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  /* A 1px black outline, so the character stands out from busy map ground. */
  filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000)
    drop-shadow(0 -1px 0 #000);
}
.board-map .sprite-character .sprite-shadow {
  left: 15px;
  width: 30px;
}
.board-map .sprite-selected .sprite-shadow {
  background: rgb(255 255 0 / 0.55);
  box-shadow: 0 0 10px 3px rgb(255 255 0 / 0.6);
}

/* Effect callouts */
.board-map .cue-icon {
  pointer-events: none;
}
/* Callouts are OSRS overhead text: bold pixel font, bright colour, hard shadow, no box. */
.board-map .cue {
  position: absolute;
  transform: translateX(-50%);
  font-family: var(--font-bold);
  font-size: var(--fs-1);
  line-height: 1;
  text-shadow: 1px 1px 0 #000;
  white-space: nowrap;
  animation: cue-rise 2.6s steps(12, end) forwards;
}
.board-map .cue-good {
  color: var(--osrs-green);
}
.board-map .cue-bad {
  color: var(--osrs-red);
}
.board-map .cue-info {
  color: var(--osrs-yellow);
}
.board-map .cue-gem {
  color: var(--osrs-cyan);
  font-size: 32px;
  text-shadow:
    2px 2px 0 #000,
    0 0 8px var(--osrs-cyan);
}
.board-map .cue-card {
  position: absolute;
  transform: translateX(-50%);
  perspective: 300px;
  animation: cue-card-life 2.6s ease-out forwards;
}
.board-map .cue-card .mini {
  position: relative;
  display: block;
  width: 30px;
  height: 42px;
  transform-style: preserve-3d;
  animation: cue-card-flip 0.7s 0.25s ease-out backwards;
}
.board-map .cue-card .mini-back,
.board-map .cue-card .mini-face {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border: 2px solid #000;
  backface-visibility: hidden;
  box-shadow: 2px 2px 0 #000;
}
.board-map .cue-card .mini-back {
  background: var(--brown-2);
  box-shadow:
    inset 0 0 0 2px var(--stone-hi),
    2px 2px 0 #000;
  transform: rotateY(180deg);
}
.board-map .cue-card .mini-face {
  background: #e8dcb8;
  color: #000;
  font-family: var(--font-bold);
  font-size: 16px;
  line-height: 1;
}
.board-map .cue-card.red .mini-face {
  color: #b00000;
}
@keyframes cue-card-flip {
  from {
    transform: rotateY(180deg);
  }
}
@keyframes cue-card-life {
  0% {
    opacity: 0;
    transform: translate(-50%, 10px) scale(0.6);
  }
  10% {
    opacity: 1;
    transform: translate(-50%, -6px) scale(1.15);
  }
  85% {
    opacity: 1;
    transform: translate(-50%, -6px) scale(1.15);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -20px) scale(1);
  }
}
@keyframes cue-rise {
  0% {
    opacity: 0;
    transform: translate(-50%, 8px) scale(0.7);
  }
  12% {
    opacity: 1;
    transform: translate(-50%, 0) scale(1.08);
  }
  20% {
    transform: translate(-50%, 0) scale(1);
  }
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -22px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .board-map * {
    animation-duration: 0.01s !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
