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
  polyline,
  tileLayer,
  type LatLng,
  type LeafletMouseEvent,
  type Map as LeafletMap,
  type Marker,
} from 'leaflet'
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import type { Board } from '@/domain/board'
import type { Challenge } from '@/domain/challenge'
import { blockerName, cardLabel, challengeProgress, type Names } from '@/domain/describe'
import type { Card, GameState, Team } from '@/domain/game'
import type { ChallengeId, TeamId, TileId } from '@/domain/ids'
import type { Choreography, Placement } from '@/domain/motion'
import { nearestTile } from '@/domain/paths'
import { spriteElement } from '@/map/sprite'
import { CRS_ORIGIN, explvTileUrl, imageBounds, tileCentre, worldMap } from '@/map/world'
import { GEM_COLORS, TILE_COLORS, teamColor } from '@/ui/colors'

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
  route: readonly TileId[] | null
  reach: { onAnyWalk: ReadonlySet<TileId>; ends: ReadonlySet<TileId> } | null
  targetTiles: ReadonlySet<TileId> | null
  /** Skip callouts for this team, whose captain is watching their draw in the panel. */
  hideCuesFor: TeamId | null
}>()

const emit = defineEmits<{
  hover: [tile: TileId]
  pick: [tile: TileId]
  select: [team: TeamId]
  /** The viewer dragged the map, which ends following. */
  freeRoam: []
  view: [bounds: { south: number; west: number; north: number; east: number }]
  openShop: [tile: TileId]
}>()

const container = useTemplateRef<HTMLDivElement>('container')
let leaflet: LeafletMap | null = null
let frame = 0

const pieces = layerGroup()
const reachLayer = layerGroup()
const routeLayer = layerGroup()
const cueLayer = layerGroup()
const teamMarkers = new Map<TeamId, { marker: Marker; el: HTMLElement; pose: string }>()
const cueMarkers = new Map<string, Marker>()

/** Zoom at which the detailed OSRS map takes over from the pixel art. */
const DETAIL_ZOOM = 1.5
/** How close, in screen pixels, the pointer must be to a tile to pick it. */
const PICK_RADIUS = 56

const BLOCKER_ICONS = { banana: '🍌', bees: '🐝', snake: '🐍', rock: '🪨' } as const

function tileLatLng(tile: TileId): LatLng | null {
  const found = props.board.tiles.get(tile)
  if (!found) return null
  const c = tileCentre(found.x, found.y)
  return latLng(c.lat, c.lng)
}

const tileGems = () => new Map([...props.state.gemTiles].map(([gem, tile]) => [tile, gem]))

/** Tile popups are built when opened, so they always show the latest state. */
function tilePopup(tile: TileId): HTMLElement {
  const info = props.board.tiles.get(tile)
  const root = document.createElement('div')
  root.className = 'tile-popup'
  const kind =
    info?.kind === 'red' ? 'Minigame tile' : info?.kind === 'shop' ? 'Shop' : 'Board tile'
  add(root, 'strong', `${kind} · #${tile}`)

  const challengeId = props.state.tileChallenges.get(tile)
  const challenge = challengeId && props.challenges.get(challengeId)
  if (challenge && info?.kind !== 'shop') {
    add(root, 'p', challenge.name).className = 'tile-popup-title'
    add(root, 'p', challenge.description)
  }
  const gem = tileGems().get(tile)
  if (gem) add(root, 'p', `💎 The ${gem} gem is here`)
  const blocker = props.state.blockers.get(tile)
  if (blocker) add(root, 'p', `${BLOCKER_ICONS[blocker.kind]} ${blockerName(blocker)}`)

  for (const team of props.state.teams.values()) {
    if (team.position !== tile) continue
    const line = add(root, 'p', `${team.name} is here`)
    line.style.color = teamColor(team)
    if (team.status.kind === 'working' && challenge) {
      const instance = props.state.instances.get(team.status.instanceId)
      const { done, needed } = challengeProgress(challenge, instance, team.id)
      line.textContent += `: ${done}/${needed}`
    }
  }
  if (info?.kind === 'shop') {
    const button = add(root, 'button', 'See what’s for sale')
    button.className = 'tile-popup-button'
    button.addEventListener('click', () => emit('openShop', tile))
  }
  return root
}

function add<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, text: string) {
  const el = document.createElement(tag)
  el.textContent = text
  parent.append(el)
  return el
}

function drawBoard(map: LeafletMap) {
  for (const [a, b] of props.board.roads) {
    const from = tileLatLng(a)
    const to = tileLatLng(b)
    if (from && to)
      polyline([from, to], {
        color: '#3b2a17',
        weight: 3,
        opacity: 0.75,
        interactive: false,
      }).addTo(map)
  }
  for (const tile of props.board.tiles.values()) {
    const at = tileLatLng(tile.id)
    if (!at) continue
    if (tile.kind === 'shop') {
      marker(at, {
        icon: divIcon({ className: 'shop-marker', html: '<span></span>', iconSize: [16, 16] }),
        title: 'Shop',
      })
        .bindPopup(() => tilePopup(tile.id))
        .addTo(map)
      continue
    }
    circleMarker(at, {
      radius: tile.kind === 'red' ? 5 : 3,
      color: '#1c1208',
      weight: 1,
      fillColor: TILE_COLORS[tile.kind],
      fillOpacity: 1,
    })
      .bindPopup(() => tilePopup(tile.id))
      .addTo(map)
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
        html: `<div class="gem-marker" style="--gem:${GEM_COLORS[gem]}"></div>`,
        iconSize: [16, 16],
      }),
      title: `${gem} gem`,
      zIndexOffset: 500,
    })
      .bindPopup(() => tilePopup(tile))
      .addTo(pieces)
  }
  for (const [tile, blocker] of props.state.blockers) {
    const at = tileLatLng(tile)
    if (!at) continue
    marker(at, {
      icon: divIcon({
        className: 'blocker-marker',
        html: BLOCKER_ICONS[blocker.kind],
        iconSize: [20, 20],
      }),
      title: blockerName(blocker),
      zIndexOffset: 400,
    })
      .bindPopup(() => tilePopup(tile))
      .addTo(pieces)
  }
}

/** Highlights where a drawn card can take the team, or where an item can be placed. */
function drawReach() {
  reachLayer.clearLayers()
  const color = props.myTeam ? teamColor(props.myTeam) : '#facc15'
  if (props.targetTiles) {
    for (const tile of props.targetTiles) {
      const at = tileLatLng(tile)
      if (at)
        circleMarker(at, {
          radius: 6,
          color: '#f97316',
          weight: 2,
          fillOpacity: 0.15,
          interactive: false,
        }).addTo(reachLayer)
    }
    return
  }
  if (!props.reach) return
  for (const tile of props.reach.onAnyWalk) {
    if (props.reach.ends.has(tile)) continue
    const at = tileLatLng(tile)
    if (at)
      circleMarker(at, {
        radius: 4,
        color,
        weight: 1,
        opacity: 0.5,
        fillOpacity: 0.25,
        interactive: false,
      }).addTo(reachLayer)
  }
  for (const tile of props.reach.ends) {
    const at = tileLatLng(tile)
    if (!at) continue
    marker(at, {
      icon: divIcon({
        className: '',
        html: `<div class="dest-ring" style="--team:${color}"></div>`,
        iconSize: [22, 22],
      }),
      interactive: false,
    }).addTo(reachLayer)
  }
}

function drawRoute() {
  routeLayer.clearLayers()
  const route = props.route
  if (!route || route.length < 2) return
  const points = route.map(tileLatLng).filter((p): p is LatLng => p !== null)
  const color = props.myTeam ? teamColor(props.myTeam) : '#facc15'
  polyline(points, { color: '#0f172a', weight: 8, opacity: 0.6, interactive: false }).addTo(
    routeLayer,
  )
  polyline(points, {
    color,
    weight: 4,
    dashArray: '8 6',
    className: 'route-line',
    interactive: false,
  }).addTo(routeLayer)
  const end = points.at(-1)
  if (!end) return
  marker(end, {
    icon: divIcon({
      className: '',
      html: `<div class="route-end" style="--team:${color}">${route.length - 1}</div>`,
      iconSize: [26, 26],
    }),
    interactive: false,
    zIndexOffset: 900,
  }).addTo(routeLayer)
}

/** Tiles the pointer can pick: item targets, or anywhere a walk can go. */
function pickable(): Iterable<TileId> | null {
  if (props.targetTiles) return props.targetTiles
  if (props.reach) return [...props.reach.onAnyWalk, ...props.reach.ends]
  return null
}

function tileUnder(e: LeafletMouseEvent): TileId | null {
  const candidates = pickable()
  if (!candidates || !leaflet) return null
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

// --- Team pieces, animated every frame from the choreography. ---

function ensureTeamMarker(map: LeafletMap, team: Team) {
  let entry = teamMarkers.get(team.id)
  if (entry) return entry
  const el = spriteElement(teamColor(team), team.name)
  const m = marker(latLng(0, 0), {
    icon: divIcon({ className: 'sprite-icon', html: el, iconSize: [32, 38], iconAnchor: [16, 34] }),
    title: team.name,
    zIndexOffset: 1000,
    keyboard: true,
  })
  m.on('click', () => emit('select', team.id))
  m.addTo(map)
  entry = { marker: m, el, pose: '' }
  teamMarkers.set(team.id, entry)
  return entry
}

function placementLatLng(p: Placement): { at: LatLng; dx: number } | null {
  if (p.kind === 'still') {
    const at = tileLatLng(p.tile)
    return at ? { at, dx: 0 } : null
  }
  const from = tileLatLng(p.from)
  const to = tileLatLng(p.to)
  if (!from || !to) return null
  if (p.kind === 'teleport') return { at: p.progress < 0.5 ? from : to, dx: 0 }
  const k = p.kind === 'slide' ? easeOut(p.progress) : p.progress
  return {
    at: latLng(from.lat + (to.lat - from.lat) * k, from.lng + (to.lng - from.lng) * k),
    dx: to.lng - from.lng,
  }
}

const easeOut = (k: number) => 1 - (1 - k) ** 3

/** Last horizontal direction each team walked, so idle pieces keep facing the same way. */
const facing = new Map<TeamId, number>()
const placed = new Map<TeamId, LatLng>()
let lastPrune = 0

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
    const p = props.choreography.placement(team.id, time)
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
    const key = `${pose}|${facing.get(team.id) ?? 1}|${slot}|${props.selected === team.id}`
    if (key !== entry.pose) {
      entry.pose = key
      entry.el.className = `sprite sprite-${pose}${props.selected === team.id ? ' sprite-selected' : ''}`
      entry.el.style.setProperty('--facing', String(facing.get(team.id) ?? 1))
      entry.el.style.setProperty('--slot', String(slot))
    }
  }

  // Callouts float above the piece they belong to.
  const active = props.choreography.activeCues(time)
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
    // The captain watches their own draw in the panel; callouts on the map would spoil it.
    if (cue.teamId === props.hideCuesFor) continue
    let m = cueMarkers.get(cue.id)
    if (!m) {
      const el = cue.card ? cardCue(cue.card) : document.createElement('div')
      if (!cue.card) {
        el.className = `cue cue-${cue.tone}`
        el.textContent = cue.text
      }
      m = marker(at, {
        icon: divIcon({ className: 'cue-icon', html: el, iconSize: [0, 0], iconAnchor: [0, 46] }),
        interactive: false,
        zIndexOffset: 2000,
      }).addTo(cueLayer)
      cueMarkers.set(cue.id, m)
    } else m.setLatLng(at)
  }

  // Follow camera: ease towards the selected team instead of jumping.
  if (props.follow && props.selected !== null) {
    const target = placed.get(props.selected)
    if (target) {
      const centre = map.getCenter()
      const dLat = target.lat - centre.lat
      const dLng = target.lng - centre.lng
      if (Math.abs(dLat) + Math.abs(dLng) > 0.05) {
        map.setView(latLng(centre.lat + dLat * 0.12, centre.lng + dLng * 0.12), map.getZoom(), {
          animate: false,
        })
      }
    }
  }
}

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
  const map = createMap(container.value, {
    crs,
    minZoom: -3,
    maxZoom: 5,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 90,
    maxBounds: bounds.pad(0.15),
    maxBoundsViscosity: 0.8,
    attributionControl: false,
    zoomControl: false,
    preferCanvas: true,
  })
  // Pixel art at the bottom, the detailed map above it once zoomed in, then the board.
  map.createPane('detail').style.zIndex = '250'
  imageOverlay(worldMap.imageUrl, bounds, { className: 'pixel-map', pane: 'tilePane' }).addTo(map)
  const detail = tileLayer('', {
    pane: 'detail',
    minZoom: DETAIL_ZOOM,
    maxZoom: 5,
    minNativeZoom: -2,
    maxNativeZoom: 5,
    noWrap: true,
    bounds,
    className: 'detail-map',
  })
  detail.getTileUrl = explvTileUrl
  detail.addTo(map)

  map.fitBounds(bounds)
  drawBoard(map)
  reachLayer.addTo(map)
  routeLayer.addTo(map)
  pieces.addTo(map)
  cueLayer.addTo(map)
  drawPieces()

  map.on('dragstart', () => emit('freeRoam'))
  map.on('moveend zoomend', emitView)
  map.on('mousemove', (e: LeafletMouseEvent) => {
    const tile = tileUnder(e)
    if (tile !== null) emit('hover', tile)
  })
  map.on('click', (e: LeafletMouseEvent) => {
    const tile = tileUnder(e)
    if (tile !== null) emit('pick', tile)
  })
  // While picking a route or a target, a click picks instead of opening tile details.
  map.on('popupopen', () => {
    if (pickable()) map.closePopup()
  })
  DomEvent.disableScrollPropagation(container.value)
  leaflet = map
  emitView()
  frame = requestAnimationFrame(renderFrame)
})

watch(() => props.state, drawPieces)
watch(() => [props.reach, props.targetTiles, props.myTeam?.id], drawReach)
watch(() => props.route, drawRoute)
watch(
  () => props.selected,
  () => {
    for (const entry of teamMarkers.values()) entry.pose = ''
  },
)

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  teamMarkers.clear()
  cueMarkers.clear()
  leaflet?.remove()
  leaflet = null
})

/** Pans and zooms to a tile. */
function locate(tile: TileId, zoom = 1) {
  const at = tileLatLng(tile)
  if (at) leaflet?.flyTo(at, Math.max(zoom, leaflet.getZoom()), { duration: 0.8 })
}

/** Pans to a world position without changing zoom. */
function panTo(lat: number, lng: number) {
  leaflet?.panTo(latLng(lat, lng))
}

function zoomBy(delta: number) {
  leaflet?.setZoom(leaflet.getZoom() + delta)
}

function showAll() {
  leaflet?.flyToBounds(latLngBounds(imageBounds(worldMap)), { duration: 0.8 })
}

defineExpose({ locate, panTo, zoomBy, showAll })
</script>

<template>
  <div ref="container" class="board-map size-full" aria-label="Board map" role="application" />
</template>

<style>
.board-map {
  background: #0b1220;
  font: inherit;
}
.board-map .pixel-map {
  image-rendering: pixelated;
}
.board-map .detail-map {
  image-rendering: pixelated;
}
.board-map .leaflet-popup-content-wrapper {
  border-radius: 10px;
  background: #0f172a;
  color: #e2e8f0;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.5);
}
.board-map .leaflet-popup-tip {
  background: #0f172a;
}
.board-map .leaflet-popup-content {
  margin: 10px 14px;
  font-size: 13px;
  line-height: 1.35;
}
.board-map .leaflet-popup-content p {
  margin: 4px 0 0;
}
.board-map .tile-popup-title {
  font-weight: 600;
  color: #fde68a;
}
.board-map .tile-popup-button {
  margin-top: 8px;
  border-radius: 6px;
  background: #f59e0b;
  padding: 4px 10px;
  color: #0f172a;
  font-weight: 600;
}
.board-map .gem-marker {
  width: 16px;
  height: 16px;
  transform: rotate(45deg);
  border: 2px solid #0f172a;
  border-radius: 3px;
  background: var(--gem);
  box-shadow: 0 0 12px var(--gem);
  animation: gem-glint 2.4s ease-in-out infinite;
}
@keyframes gem-glint {
  50% {
    box-shadow: 0 0 20px var(--gem);
    filter: brightness(1.3);
  }
}
.board-map .shop-marker span {
  display: block;
  width: 16px;
  height: 16px;
  border: 2px solid #1c1208;
  border-radius: 3px;
  background: linear-gradient(#f59e0b 0 45%, #fde68a 45%);
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.5);
}
.board-map .blocker-marker {
  font-size: 17px;
  line-height: 20px;
  text-align: center;
  filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.6));
}
.board-map .dest-ring {
  width: 22px;
  height: 22px;
  border: 3px solid var(--team);
  border-radius: 9999px;
  animation: dest-pulse 1.4s ease-out infinite;
}
@keyframes dest-pulse {
  0% {
    transform: scale(0.6);
    opacity: 1;
  }
  100% {
    transform: scale(1.3);
    opacity: 0.2;
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
.board-map .route-end {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border: 2px solid #0f172a;
  border-radius: 9999px;
  background: var(--team);
  color: #0f172a;
  font-weight: 800;
  font-size: 12px;
}

/* Team pieces */
.board-map .sprite-icon {
  pointer-events: auto;
}
.board-map .sprite {
  position: relative;
  width: 32px;
  height: 38px;
  transform: translateX(calc(var(--slot, 0) * 20px));
  transition: transform 0.3s;
  cursor: pointer;
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
  border-radius: 9999px;
  background: rgb(0 0 0 / 0.45);
}
.board-map .sprite-label {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 0 4px;
  border-radius: 4px;
  background: rgb(15 23 42 / 0.85);
  color: #e2e8f0;
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
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
.board-map .sprite-selected .sprite-shadow {
  background: rgb(250 204 21 / 0.55);
  box-shadow: 0 0 10px 3px rgb(250 204 21 / 0.6);
}

/* Effect callouts */
.board-map .cue-icon {
  pointer-events: none;
}
.board-map .cue {
  position: absolute;
  transform: translateX(-50%);
  padding: 2px 8px;
  border: 2px solid #0f172a;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
  animation: cue-rise 2.6s ease-out forwards;
}
.board-map .cue-good {
  background: #4ade80;
  color: #052e16;
}
.board-map .cue-bad {
  background: #f87171;
  color: #450a0a;
}
.board-map .cue-info {
  background: #e2e8f0;
  color: #0f172a;
}
.board-map .cue-gem {
  background: linear-gradient(90deg, #a855f7, #3b82f6, #22c55e);
  color: white;
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
  border-radius: 4px;
  backface-visibility: hidden;
  box-shadow: 0 3px 8px rgb(0 0 0 / 0.5);
}
.board-map .cue-card .mini-back {
  border: 2px solid #f8fafc;
  background: repeating-linear-gradient(45deg, #6d28d9 0 3px, #7c3aed 3px 6px);
  transform: rotateY(180deg);
}
.board-map .cue-card .mini-face {
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
  font-size: 12px;
  font-weight: 900;
}
.board-map .cue-card.red .mini-face {
  color: #dc2626;
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
