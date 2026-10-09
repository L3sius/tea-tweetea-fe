<script setup lang="ts">
import {
  CRS,
  DomEvent,
  Transformation,
  Util,
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
  type ImageOverlay,
  type LatLng,
  type LatLngBounds,
  type LeafletMouseEvent,
  type Map as LeafletMap,
  type Marker,
  type Point,
  type ZoomAnimEvent,
} from 'leaflet'
import { h, onBeforeUnmount, onMounted, ref, render, useTemplateRef, watch } from 'vue'
import type { Board, Tile } from '@/domain/board'
import type { Challenge } from '@/domain/challenge'
import {
  blockerFreezeText,
  blockerName,
  cardLabel,
  challengeProgress,
  clock,
  type Names,
} from '@/domain/describe'
import type { Blocker, Card, GameState, Team } from '@/domain/game'
import type { ChallengeId, TeamId, TileId } from '@/domain/ids'
import type { Choreography, Cue, Placement } from '@/domain/motion'
import type { Replay } from '@/domain/replay'
import { adjacency, nearestTile, sharedLength, type WalkOptions } from '@/domain/paths'
import { perform, ticksToMs } from '@/characters/acting'
import { PASS_QUOTE, chatStyle, idleQuote, quoteMs, type Quote } from '@/characters/quotes'
import { animationInfoOf, loadAnimationInfo } from '@/characters/assets'
import { HEADING, headingOf } from '@/characters/heading'
import type { Appearance } from '@/characters/roster'
import type * as Stage from '@/characters/stage'
import type { Guide } from '@/stores/tutorial'
import type { BoardLayer, RevealName } from '@/tutorial/script'
import { characterElement, spriteElement } from '@/map/sprite'
import { itemEntry } from '@/domain/items'
import type { Item } from '@/domain/vocabulary'
import { liveCanvas } from '@/map/liveCanvas'
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
  /** A quote the dev tools asked a character to say, on top of the ones the clock picks. */
  devQuote?: Quote | null
  /** How a team's piece looks as an OSRS character, or null to draw it as a bird. */
  appearanceOf: (team: TeamId) => Appearance | null
  /** The parts of the board to draw (the tutorial builds it up); every part when not given. */
  layers?: ReadonlySet<RevealName> | null
  /** The tutorial's guide, walking the board. */
  guide?: Guide | null
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
const roadLayer = layerGroup()
const nodeLayer = layerGroup()
const shopLayer = layerGroup()
let terrain: ImageOverlay | null = null
let resizing: ResizeObserver | null = null
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
/** Each walking team's "pass" line: the walk it was said on, so a walk says it only once. */
const passQuotes = new Map<TeamId, Quote & { seq: number }>()

/**
 * How close, in screen pixels, the pointer must be to a node to hover or pick it. Nodes keep the
 * same pixel size at every zoom, so this always matches what is drawn; neighbouring tiles sit
 * about 46px apart at zoom 0, where the map goes when a walk starts.
 */
const PICK_RADIUS = 20

const BLOCKER_ICONS: Partial<Record<Item, string>> = {
  banana: '🍌',
  harpie_bug_swarm: '🐝',
  snake_charmer: '🐍',
  wilderness_web: '🕸️',
}

/** Blockers with a kit sprite draw it; the rest fall back to their emoji. */
const blockerHtml = (item: Item) =>
  item === 'banana'
    ? '<span class="tt-sprite tt-icon-banana"></span>'
    : (BLOCKER_ICONS[item] ?? '⛔')

/** The last click while picking: a yellow cross on a tile, red when it missed. */
const click = ref<{ x: number; y: number; key: number; color: 'yellow' | 'red' } | null>(null)

function tileLatLng(tile: TileId): LatLng | null {
  const found = props.board.tiles.get(tile)
  if (!found) return null
  const c = tileCentre(found.x, found.y)
  return latLng(c.lat, c.lng)
}

const tileGems = () => new Map([...props.state.gemTiles].map(([gem, tile]) => [tile, gem]))

/** What a blocker does to whoever walks onto it, who placed it and when it goes. */
function blockerText(blocker: Blocker): string {
  const freeze = blockerFreezeText(blocker)
  const stops = freeze
    ? `stops every team that walks onto it and freezes it for ${freeze}.`
    : 'stops every team that walks onto it.'
  return `${stops} Placed by ${props.names.team(blocker.owner)}, gone at ${clock(blocker.until)}.`
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
          icon: itemEntry(blocker.item).icon,
          text: blockerText(blocker),
          web: blocker.item === 'wilderness_web',
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

function drawBoard() {
  // Roads: a black outline under a parchment line, as on the event site's board.
  const roads = props.board.roads.flatMap(([a, b]) => {
    const from = tileLatLng(a)
    const to = tileLatLng(b)
    return from && to ? [[from, to]] : []
  })
  roadLines(roads).forEach((line) => line.addTo(roadLayer))
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
      }).addTo(shopLayer)
      continue
    }
    nodeDot(tile, at).addTo(nodeLayer)
  }
  applyLayers()
}

/** Roads: a black outline under a parchment line, as on the event site's board. */
const roadLines = (roads: LatLng[][]) => [
  polyline(roads, { color: '#000', weight: 5.5, opacity: 0.85, interactive: false }),
  polyline(roads, { color: '#c8b98a', weight: 2.5, opacity: 0.95, interactive: false }),
]

const nodeDot = (tile: Tile, at: LatLng) =>
  circleMarker(at, {
    radius: tile.kind === 'red' ? 8 : 6,
    color: '#000',
    weight: 1.5,
    fillColor: TILE_COLORS[tile.kind],
    fillOpacity: 1,
    interactive: false,
  })

// --- Building the board up, for the tutorial ---

const shown = (layer: BoardLayer) => !props.layers || props.layers.has(layer)

/** Roads and nodes spreading out from the guide; replaced by the whole board once it's done. */
const spreadRoads = layerGroup()
const spreadNodes = layerGroup()
let spreadFrame = 0
const SPREAD_MS = 2600

/**
 * Shows the parts of the board in `layers`. Canvas layers draw in the order they join the map, so
 * the roads, nodes and walk highlights go back on in that order whenever one comes or goes.
 */
function applyLayers() {
  const map = leaflet
  if (!map) return
  terrain?.setOpacity(shown('terrain') ? 1 : 0)
  for (const layer of [roadLayer, nodeLayer, reachLayer, routeLayer]) layer.remove()
  if (shown('roads') && !spreadFrame) roadLayer.addTo(map)
  if (shown('nodes') && !spreadFrame) nodeLayer.addTo(map)
  reachLayer.addTo(map)
  routeLayer.addTo(map)
  for (const [layer, on] of [
    [shopLayer, shown('landmarks')],
    [pieces, shown('landmarks')],
  ] as const) {
    if (on) layer.addTo(map)
    else layer.remove()
  }
  map.getContainer().classList.toggle('hide-teams', !shown('teams'))
}

/** Draws the roads and nodes ring by ring outwards from `origin`, then the whole board. */
function spreadFrom(origin: TileId) {
  const map = leaflet
  if (!map) return
  cancelAnimationFrame(spreadFrame)
  const roads = adjacency(props.board.roads)
  const depth = new Map<TileId, number>([[origin, 0]])
  const queue = [origin]
  for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
    for (const next of roads.get(at) ?? []) {
      if (depth.has(next)) continue
      depth.set(next, (depth.get(at) ?? 0) + 1)
      queue.push(next)
    }
  }
  const deepest = Math.max(1, ...depth.values())
  spreadRoads.clearLayers().addTo(map)
  spreadNodes.clearLayers().addTo(map)
  let drawn = -1
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / SPREAD_MS)
    const ring = Math.floor(t * (deepest + 1))
    for (let d = drawn + 1; d <= ring; d++) {
      const lines = props.board.roads.flatMap(([a, b]) => {
        const from = tileLatLng(a)
        const to = tileLatLng(b)
        const first = Math.min(depth.get(a) ?? Infinity, depth.get(b) ?? Infinity)
        return from && to && first === d - 1 ? [[from, to]] : []
      })
      if (lines.length) roadLines(lines).forEach((line) => line.addTo(spreadRoads))
      for (const [id, tileDepth] of depth) {
        const tile = props.board.tiles.get(id)
        const at = tileLatLng(id)
        if (tileDepth === d && tile && at && tile.kind !== 'shop')
          nodeDot(tile, at).addTo(spreadNodes)
      }
      // Nodes stay on top of roads drawn after them.
      spreadNodes.remove().addTo(map)
    }
    drawn = ring
    if (t < 1) {
      spreadFrame = requestAnimationFrame(step)
      return
    }
    spreadFrame = 0
    spreadRoads.remove()
    spreadNodes.remove()
    applyLayers()
  }
  spreadFrame = requestAnimationFrame(step)
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
        html: blockerHtml(blocker.item),
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
  const k = p.progress
  return {
    at: latLng(from.lat + (to.lat - from.lat) * k, from.lng + (to.lng - from.lng) * k),
    dx: to.lng - from.lng,
    dy: to.lat - from.lat,
  }
}

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
  // Characters face the way they walk, and turn to the viewer once they stop.
  const heading = p.kind === 'walk' ? (walkHeading.get(team.id) ?? HEADING.south) : HEADING.south
  piece.draw(performance, heading, time)
}

// --- The tutorial's guide ---

type GuideMarker = {
  marker: Marker
  piece: Stage.CharacterPiece | null
  /** The last way he walked, kept while he stands. */
  heading: number
  say: Marker | null
  saying: string | null
}
let guideMarker: GuideMarker | null = null

function ensureGuide(map: LeafletMap, guide: Guide): GuideMarker {
  if (guideMarker) return guideMarker
  const canvas = document.createElement('canvas')
  canvas.width = CHARACTER_SIZE.width
  canvas.height = CHARACTER_SIZE.height - 4
  const el = characterElement(canvas, 'var(--osrs-orange)', guide.name)
  el.className = 'sprite sprite-character sprite-guide'
  const m = marker(latLng(0, 0), {
    icon: divIcon({
      className: 'sprite-icon guide-icon',
      html: el,
      iconSize: [CHARACTER_SIZE.width, CHARACTER_SIZE.height],
      iconAnchor: [CHARACTER_SIZE.width / 2, CHARACTER_SIZE.height - 4],
    }),
    zIndexOffset: 1500,
    interactive: false,
  }).addTo(map)
  const created: GuideMarker = {
    marker: m,
    piece: null,
    heading: HEADING.south,
    say: null,
    saying: null,
  }
  guideMarker = created
  void loadAnimationInfo()
  void loadStage().then(({ CharacterPiece }) => {
    if (guideMarker === created) created.piece = new CharacterPiece(guide.npc, canvas)
  })
  return created
}

function removeGuide() {
  guideMarker?.marker.remove()
  guideMarker?.say?.remove()
  guideMarker?.piece?.dispose()
  guideMarker = null
}

/** Draws the guide where his script has him, with his overhead line, if any. */
function drawGuide(map: LeafletMap, time: number) {
  const guide = props.guide
  if (!guide) return removeGuide()
  const entry = ensureGuide(map, guide)
  const p = guide.placement(time)
  const where = p && placementLatLng(p)
  if (!p || !where) return
  entry.marker.setLatLng(where.at)
  if (p.kind === 'walk' && (where.dx !== 0 || where.dy !== 0))
    entry.heading = headingOf(where.dx, where.dy)
  // He faces the way he walks, and turns to the viewer to talk.
  const heading = p.kind === 'walk' ? entry.heading : HEADING.south
  entry.piece?.draw(guide.performance(time, p), heading, time)

  const text = guide.say(time)
  if (text !== entry.saying) {
    entry.say?.remove()
    entry.say = null
    entry.saying = text
    if (text !== null) {
      const el = document.createElement('div')
      el.className = 'cue cue-info'
      el.textContent = text
      entry.say = marker(where.at, {
        icon: divIcon({
          className: 'cue-icon cue-over-character guide-say',
          html: el,
          iconSize: [0, 0],
          iconAnchor: [0, CHARACTER_SIZE.height + 4],
        }),
        interactive: false,
        zIndexOffset: 2000,
      }).addTo(map)
    }
  }
  entry.say?.setLatLng(where.at)
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
  const talking = new Set(active.map((c) => c.teamId))
  const overheads: Overhead[] = [
    ...active.map((cue) => ({
      id: cue.id,
      teamId: cue.teamId,
      card: cue.card !== undefined,
      make: () => {
        if (cue.card) return cardCue(cue.card)
        const el = document.createElement('div')
        el.className = `cue cue-${cue.tone}`
        el.textContent = cue.text
        return el
      },
    })),
    ...quotesAt(time, placements, still, talking).map((q) => ({
      id: `quote-${q.team}-${q.since}`,
      teamId: q.team,
      card: false,
      make: () => quoteElement(q),
    })),
  ]
  const live = new Set(overheads.map((o) => o.id))
  for (const [id, m] of cueMarkers) {
    if (!live.has(id)) {
      cueLayer.removeLayer(m)
      cueMarkers.delete(id)
    }
  }
  for (const cue of overheads) {
    const at = placed.get(cue.teamId)
    if (!at) continue
    let m = cueMarkers.get(cue.id)
    if (!m) {
      const el = cue.make()
      const character = teamMarkers.get(cue.teamId)?.npc != null
      // A character's drawn card goes beside it, level with its body, so it never hides the
      // character's reaction to it (a Joker makes it cry). Other callouts go over its head.
      const beside = character && cue.card
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

  drawGuide(map, time)

  // Follow camera: ease towards the selected team instead of jumping. It waits out a flight, since
  // moving the view would cut the flight short, and a zoom, which it would make jerk.
  if (props.follow && props.selected !== null && !flying && !zooming && !glideFrame) {
    const want = followCentre(map, props.selected, map.getZoom())
    if (want) followStep(map, want)
  }
}

/** Something drawn over a piece: a callout, a drawn card or a quote. */
type Overhead = { id: string; teamId: TeamId; card: boolean; make: () => HTMLElement }

/**
 * The quotes over the pieces at `time`: the board's idle quote, if its character stands idle and
 * has no callout up; each walking team's line as it passes a team standing on its path; and a
 * quote from the dev tools.
 */
function quotesAt(
  time: number,
  placements: ReadonlyMap<TeamId, Placement | null>,
  still: ReadonlyMap<TileId, TeamId[]>,
  talking: ReadonlySet<TeamId>,
): Quote[] {
  const out: Quote[] = []
  const teams = [...props.state.teams.values()]
  const players = teams.flatMap((t) => t.members.map((m) => m.name)).sort()
  const idle = idleQuote(
    time,
    teams.map((t) => t.id).sort((a, b) => a - b),
    players,
  )
  const speaker = idle ? props.state.teams.get(idle.team) : undefined
  if (idle && speaker) {
    const p = placements.get(idle.team)
    const frozen = speaker.frozenUntil !== null && speaker.frozenUntil.getTime() > time
    if ((p === null || p?.kind === 'still') && !frozen && !talking.has(idle.team)) out.push(idle)
  }
  for (const [team, p] of placements) {
    if (p?.kind !== 'walk') continue
    const passing = still.has(p.to) || still.has(p.from)
    if (passing && passQuotes.get(team)?.seq !== p.seq) {
      const { text, ...style } = chatStyle(PASS_QUOTE, 'pass', team, p.seq)
      passQuotes.set(team, {
        team,
        text,
        style,
        since: time,
        until: time + quoteMs(text),
        seq: p.seq,
      })
    }
  }
  for (const q of passQuotes.values()) if (time < q.until) out.push(q)
  const dev = props.devQuote
  if (dev && time >= dev.since && time < dev.until) out.push(dev)
  return out
}

/** Motions that move each letter on its own, so the text is split into one span per letter. */
const LETTER_MOTIONS = new Set(['wave', 'wave2', 'shake'])

/**
 * A quote as OSRS overhead chat. The line moves (scroll, slide), the span inside it carries the
 * colour, and the letters inside that move on their own (wave, shake): three elements, so a
 * colour animation and a motion never cancel each other out.
 */
function quoteElement(q: Quote): HTMLElement {
  const el = document.createElement('div')
  el.className = `quote chat-${q.style.motion}`
  el.style.setProperty('--quote-ms', `${q.until - q.since}ms`)
  const coloured = document.createElement('span')
  coloured.className = `chat-${q.style.colour}`
  el.append(coloured)
  if (!LETTER_MOTIONS.has(q.style.motion)) {
    coloured.textContent = q.text
    return el
  }
  ;[...q.text].forEach((char, i) => {
    const letter = document.createElement('span')
    letter.className = 'chat-letter'
    letter.textContent = char === ' ' ? ' ' : char
    letter.style.setProperty('--i', String(i))
    coloured.append(letter)
  })
  return el
}

/** Screen pixels from a team's tile up to the middle of its piece, at `zoom`. */
function bodyLift(team: TeamId, zoom: number): number {
  return teamMarkers.get(team)?.npc != null ? 38 * pieceScale(zoom) : 17
}

/**
 * The view centre (in pixels at `zoom`) that puts a team's piece in the middle: its body, not
 * its feet, as near as the map's edges allow.
 */
function followCentre(map: LeafletMap, team: TeamId, zoom: number): Point | null {
  const at = placed.get(team)
  if (!at) return null
  const want = map.project(at, zoom).subtract(point(0, bodyLift(team, zoom)))
  if (mapBounds) {
    const half = map.getSize().divideBy(2)
    const a = map.project(mapBounds.getNorthWest(), zoom)
    const b = map.project(mapBounds.getSouthEast(), zoom)
    want.x = clampCentre(want.x, Math.min(a.x, b.x) + half.x, Math.max(a.x, b.x) - half.x)
    want.y = clampCentre(want.y, Math.min(a.y, b.y) + half.y, Math.max(a.y, b.y) - half.y)
  }
  return want
}

/** Share of the way to the followed team the camera moves each frame. */
const FOLLOW_EASE = 0.12

/**
 * Moves the view a step towards the centre `want` (pixels at the current zoom), in whole pixels,
 * as Leaflet pans. It stops within a pixel of it: every move redraws the roads and reports the
 * view, so a camera that keeps nudging at a pixel's fraction would do that every frame.
 */
function followStep(map: LeafletMap, want: Point) {
  const gap = want.subtract(map.project(map.getCenter(), map.getZoom()))
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
    // Roads and nodes go on one canvas, drawn with a margin of 40% of the view around it and
    // drawn again whenever a move is about to run past that margin (see liveCanvas).
    renderer: liveCanvas({ padding: 0.4 }),
  })
  // Always the pixel-art map; the board is drawn over it at fixed pixel sizes.
  terrain = imageOverlay(worldMap.imageUrl, bounds, {
    className: 'pixel-map',
    pane: 'tilePane',
  }).addTo(map)

  // The map always fills the view: zooming out stops where it just covers it, and panning stops at
  // its edges, so no background ever shows. Fully zoomed out it centres itself, as "All" does.
  const fillView = () => map.setMinZoom(map.getBoundsZoom(bounds, true))
  fillView()
  map.on('resize', fillView)
  map.setView(bounds.getCenter(), map.getMinZoom())
  // In free roam, zooming all the way out lands in the overview; a flight to a team never does.
  // While following a team, zooming out stays on the team: only a drag, "All" or Stop ends
  // following. Every wheel tick stops a running glide, even at full zoom-out, so the overview
  // waits until the wheel is quiet, and scrolling out further there brings it back if a tick cut
  // it short.
  const atMin = () => map.getZoom() <= map.getMinZoom() + 0.001
  let overviewTimer: ReturnType<typeof setTimeout> | undefined
  const overviewSoon = () => {
    clearTimeout(overviewTimer)
    if (props.follow) return
    overviewTimer = setTimeout(() => !props.follow && atMin() && showAll(), OVERVIEW_QUIET_MS)
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
  drawBoard()
  cueLayer.addTo(map)
  // The map fills whatever room it has, as panels come and go.
  resizing = new ResizeObserver(() => map.invalidateSize({ animate: false }))
  resizing.observe(container.value)
  drawPieces()
  drawReach()
  drawRoute()

  map.on('dragstart', () => {
    stopFlight()
    stopGlide()
    emit('freeRoam')
  })
  // While following, the wheel glides on the team instead of Leaflet's zoom on the pointer.
  container.value.addEventListener(
    'wheel',
    (e) => {
      if (!props.follow || props.selected === null) return
      e.preventDefault()
      const px = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY
      glideZoomBy(-px * WHEEL_ZOOM_PER_PX)
    },
    { passive: false },
  )
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
watch(
  () => props.layers,
  (now, before) => {
    // Roads appearing with the guide on the board spread out from him.
    const tile = props.guide?.placement(props.serverNow())
    const origin = tile?.kind === 'still' ? tile.tile : null
    const appearing = shown('roads') && before && !before.has('roads')
    if (appearing && origin !== null) spreadFrom(origin)
    applyLayers()
  },
)

/**
 * While following, the wheel, a double click and a pinch zoom on the centre, where the team is,
 * instead of on the pointer. Zooming on the pointer carried the team off centre and the camera
 * then dragged it back, swinging the view.
 */
function zoomAroundCentre(following: boolean) {
  const map = leaflet
  if (!map) return
  const on = following ? 'center' : true
  map.options.doubleClickZoom = on
  map.options.touchZoom = on
  // The wheel glides on the team while following (see glideZoomBy), and zooms on the pointer else.
  if (following) map.scrollWheelZoom.disable()
  else {
    stopGlide()
    followAtMin = false
    map.scrollWheelZoom.enable()
  }
}

onBeforeUnmount(() => {
  stopFlight()
  stopGlide()
  cancelAnimationFrame(spreadFrame)
  resizing?.disconnect()
  removeGuide()
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
function locate(tile: TileId, zoom = 1, ms = FLIGHT_MS) {
  const map = leaflet
  const at = tileLatLng(tile)
  if (!map || !at) return
  const target = Math.max(zoom, map.getMinZoom() + LOCATE_ZOOM_IN, map.getZoom())
  fly(map, at, Math.min(target, map.getMaxZoom()), ms)
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
function fly(map: LeafletMap, at: LatLng, zoom: number, ms = FLIGHT_MS) {
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
    const t = ms > 0 ? Math.min(1, (now - start) / ms) : 1
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

// --- Zooming while following: a smooth glide centred on the team's piece ---

/** Share of the way to the target zoom each frame: quick at first, gentle as it arrives. */
const GLIDE_EASE = 0.15
/** Zoom levels per pixel of wheel movement, about Leaflet's own feel for one notch. */
const WHEEL_ZOOM_PER_PX = 0.75 / 120
/** A wheel event this long after the last one starts a new gesture. */
const GESTURE_GAP_MS = 250

/** The zoom the glide is heading for, or null when it isn't gliding. */
let glideTarget: number | null = null
let glideFrame = 0
let restoreGlideSnap = () => {}
/** The view reached full zoom-out while following: a new gesture outward ends following. */
let followAtMin = false
let lastWheelOut = 0

/**
 * Zooms by `delta` levels while following: the map glides there frame by frame, always centred on
 * the team's piece. Zooming out from full zoom-out, in a new gesture, shows the whole map and ends
 * following instead, so one fast scroll can not end it by accident.
 */
function glideZoomBy(delta: number) {
  const map = leaflet
  if (!map || props.selected === null) return
  const min = map.getMinZoom()
  const from = glideTarget ?? map.getZoom()
  if (delta < 0) {
    const now = performance.now()
    const newGesture = now - lastWheelOut > GESTURE_GAP_MS
    lastWheelOut = now
    if (from <= min + 0.001) {
      if (followAtMin && newGesture) {
        stopGlide()
        showAll()
      }
      return
    }
  }
  stopFlight()
  // Quarter steps, as the map's own zoom snaps.
  const target = Math.round(Math.min(map.getMaxZoom(), Math.max(min, from + delta)) * 4) / 4
  glideTarget = Math.max(min, target)
  followAtMin = false
  if (glideFrame) return
  const snap = map.options.zoomSnap
  map.options.zoomSnap = 0
  restoreGlideSnap = () => (map.options.zoomSnap = snap)
  glideFrame = requestAnimationFrame(glideStep)
}

function glideStep() {
  const map = leaflet
  const team = props.selected
  if (!map || glideTarget === null || team === null) return stopGlide()
  const zoom = map.getZoom()
  const next =
    Math.abs(glideTarget - zoom) < 0.003 ? glideTarget : zoom + (glideTarget - zoom) * GLIDE_EASE
  const centre = followCentre(map, team, next)
  if (centre) map.setView(map.unproject(centre, next), next, { animate: false })
  if (next !== glideTarget) {
    glideFrame = requestAnimationFrame(glideStep)
    return
  }
  followAtMin = next <= map.getMinZoom() + 0.001
  stopGlide()
}

function stopGlide() {
  if (glideFrame) cancelAnimationFrame(glideFrame)
  glideFrame = 0
  glideTarget = null
  restoreGlideSnap()
  restoreGlideSnap = () => {}
}

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
  if (props.follow && props.selected !== null) return glideZoomBy(delta)
  stopFlight()
  leaflet?.setZoom(leaflet.getZoom() + delta)
}

/**
 * The overview: fully zoomed out and centred, from "All" or from zooming out as far as it goes. It
 * ends following, which would otherwise pull the view off centre again.
 */
function showAll(ms = FLIGHT_MS) {
  const map = leaflet
  if (!map) return
  const centre = latLngBounds(imageBounds(worldMap)).getCenter()
  const off = map.latLngToContainerPoint(centre).distanceTo(map.getSize().divideBy(2))
  if (off < 2 && map.getZoom() <= map.getMinZoom() + 0.001) return
  emit('freeRoam')
  fly(map, centre, map.getMinZoom(), ms)
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
  /* The tutorial fades the map in. */
  transition: opacity 1.8s ease;
  image-rendering: pixelated;
}
/* Teams the tutorial hasn't introduced yet; its guide and his lines still show. */
.board-map.hide-teams .sprite-icon:not(.guide-icon),
.board-map.hide-teams .cue-icon:not(.guide-say) {
  visibility: hidden;
}
/* The guide stands a head taller than the teams' pieces. */
.board-map .sprite-guide .sprite-body {
  transform: scale(1.25);
  transform-origin: 50% 100%;
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
/* A quote is OSRS overhead chat: yellow, still, over the head while it lasts. */
.board-map .quote {
  position: absolute;
  transform: translateX(-50%);
  font-family: var(--font-bold);
  font-size: var(--fs-1);
  line-height: 1;
  color: var(--osrs-yellow);
  text-shadow: 1px 1px 0 #000;
  white-space: nowrap;
}
/* OSRS chat colours. Flash blinks between two colours; glow fades through a cycle. */
.board-map .chat-red {
  color: #ff0000;
}
.board-map .chat-green {
  color: #00ff00;
}
.board-map .chat-cyan {
  color: #00ffff;
}
.board-map .chat-purple {
  color: #ff00ff;
}
.board-map .chat-white {
  color: #ffffff;
}
.board-map .chat-flash1 {
  animation: chat-flash1 0.4s steps(1) infinite;
}
.board-map .chat-flash2 {
  animation: chat-flash2 0.4s steps(1) infinite;
}
.board-map .chat-flash3 {
  animation: chat-flash3 0.4s steps(1) infinite;
}
.board-map .chat-glow1 {
  animation: chat-glow1 2.4s linear infinite;
}
.board-map .chat-glow2 {
  animation: chat-glow2 2.4s linear infinite;
}
.board-map .chat-glow3 {
  animation: chat-glow3 2.4s linear infinite;
}
@keyframes chat-flash1 {
  0% {
    color: #ff0000;
  }
  50% {
    color: #ffff00;
  }
}
@keyframes chat-flash2 {
  0% {
    color: #00ffff;
  }
  50% {
    color: #0000ff;
  }
}
@keyframes chat-flash3 {
  0% {
    color: #00b000;
  }
  50% {
    color: #80ff80;
  }
}
@keyframes chat-glow1 {
  0%,
  100% {
    color: #ff0000;
  }
  33% {
    color: #ffff00;
  }
  66% {
    color: #00ffff;
  }
}
@keyframes chat-glow2 {
  0%,
  100% {
    color: #ff0000;
  }
  33% {
    color: #ff00ff;
  }
  66% {
    color: #0000ff;
  }
}
@keyframes chat-glow3 {
  0%,
  100% {
    color: #ffffff;
  }
  33% {
    color: #00ff00;
  }
  66% {
    color: #00ffff;
  }
}
/* OSRS chat motions. Letters keep their own place in the wave by their index. */
.board-map .chat-letter {
  display: inline-block;
}
.board-map .chat-wave .chat-letter {
  animation: chat-wave 0.8s ease-in-out infinite;
  animation-delay: calc(var(--i) * -0.1s);
}
.board-map .chat-wave2 .chat-letter {
  animation: chat-wave2 0.8s ease-in-out infinite;
  animation-delay: calc(var(--i) * -0.1s);
}
/* Shake jitters at first, then settles, as it does in game. */
.board-map .chat-shake .chat-letter {
  animation: chat-shake 0.12s steps(2) 8;
  animation-delay: calc(var(--i) * -0.03s);
}
.board-map .chat-scroll {
  animation: chat-scroll var(--quote-ms) linear forwards;
}
.board-map .chat-slide {
  animation: chat-slide var(--quote-ms) ease-in-out forwards;
}
@keyframes chat-wave {
  0%,
  100% {
    translate: 0 0;
  }
  50% {
    translate: 0 -4px;
  }
}
@keyframes chat-wave2 {
  0%,
  100% {
    translate: 0 0;
  }
  25% {
    translate: 2px -3px;
  }
  50% {
    translate: 0 -4px;
  }
  75% {
    translate: -2px -3px;
  }
}
@keyframes chat-shake {
  0% {
    translate: 1px -2px;
  }
  50% {
    translate: -1px 2px;
  }
}
@keyframes chat-scroll {
  from {
    translate: 60px 0;
  }
  to {
    translate: -60px 0;
  }
}
@keyframes chat-slide {
  0% {
    translate: 0 -18px;
    opacity: 0;
  }
  12%,
  88% {
    translate: 0 0;
    opacity: 1;
  }
  100% {
    translate: 0 -18px;
    opacity: 0;
  }
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
