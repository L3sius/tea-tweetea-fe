<script setup lang="ts">
import { computed } from 'vue'
import type { Board } from '@/domain/board'
import type { GameState } from '@/domain/game'
import type { TeamId, TileId } from '@/domain/ids'
import { worldMap } from '@/map/world'
import { GEM_COLORS, teamColor } from '@/ui/colors'

const props = defineProps<{
  board: Board
  state: GameState
  /** The main map's visible area, in world coordinates. */
  view: { south: number; west: number; north: number; east: number } | null
  selected: TeamId | null
  /** Where each team's piece is drawn right now, which lags the state while it walks. */
  shownAt: (team: TeamId) => TileId
}>()
const emit = defineEmits<{ jump: [lat: number, lng: number]; select: [team: TeamId] }>()

const t = worldMap.tilesPerPixel
const widthTiles = worldMap.width * t
const heightTiles = worldMap.height * t
const top = worldMap.yMax + 1

/** A world position as percentages of the inset, from its top left. */
const percent = (x: number, y: number) => ({
  left: ((x - worldMap.xMin) / widthTiles) * 100,
  top: ((top - y) / heightTiles) * 100,
})

const at = (tile: TileId) => {
  const found = props.board.tiles.get(tile)
  return found ? percent(found.x + 0.5, found.y + 0.5) : null
}

const gems = computed(() =>
  [...props.state.gemTiles].flatMap(([gem, tile]) => {
    const p = at(tile)
    return p ? [{ gem, ...p }] : []
  }),
)

const teams = computed(() =>
  [...props.state.teams.values()].flatMap((team) => {
    const p = at(props.shownAt(team.id))
    return p ? [{ id: team.id, name: team.name, color: teamColor(team), ...p }] : []
  }),
)

const viewBox = computed(() => {
  const v = props.view
  if (!v) return null
  const a = percent(v.west, v.north)
  const b = percent(v.east, v.south)
  const left = Math.max(0, a.left)
  const topPct = Math.max(0, a.top)
  return {
    left: `${left}%`,
    top: `${topPct}%`,
    width: `${Math.max(0, Math.min(100, b.left) - left)}%`,
    height: `${Math.max(0, Math.min(100, b.top) - topPct)}%`,
  }
})

function onClick(e: MouseEvent) {
  const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const fx = (e.clientX - box.left) / box.width
  const fy = (e.clientY - box.top) / box.height
  emit('jump', top - fy * heightTiles, worldMap.xMin + fx * widthTiles)
}
</script>

<template>
  <div
    class="relative overflow-hidden rounded-lg border-2 border-slate-900 bg-slate-900 shadow-xl"
    :style="{ aspectRatio: `${worldMap.width} / ${worldMap.height}` }"
  >
    <button
      type="button"
      class="absolute inset-0 cursor-crosshair"
      aria-label="Overview map: click to jump there"
      @click="onClick"
    >
      <img
        :src="worldMap.imageUrl"
        alt=""
        class="size-full opacity-70 saturate-50"
        style="image-rendering: pixelated"
      />
    </button>
    <div
      v-if="viewBox"
      class="pointer-events-none absolute border border-amber-300/90 bg-amber-200/10"
      :style="viewBox"
    />
    <span
      v-for="g in gems"
      :key="g.gem"
      class="pointer-events-none absolute size-2 -translate-1/2 rotate-45 border border-slate-950"
      :style="{ left: `${g.left}%`, top: `${g.top}%`, background: GEM_COLORS[g.gem] }"
      :title="`${g.gem} gem`"
    />
    <button
      v-for="team in teams"
      :key="team.id"
      type="button"
      class="absolute size-3 -translate-1/2 rounded-full border-2 border-slate-950 transition-[left,top] duration-700"
      :class="selected === team.id ? 'ring-2 ring-amber-300' : ''"
      :style="{ left: `${team.left}%`, top: `${team.top}%`, background: team.color }"
      :title="team.name"
      :aria-label="`Follow ${team.name}`"
      @click.stop="emit('select', team.id)"
    />
  </div>
</template>
