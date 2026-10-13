<script setup lang="ts">
import { useRafFn } from '@vueuse/core'
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { RANDOM } from '@/characters/roster'
import { CharacterPiece } from '@/characters/stage'
import { TtIcon } from '@/ui/tt'

const props = withDefaults(
  defineProps<{
    npc: number
    /** The animation it loops. */
    anim: number
    /** Played in turn while `anim` is RANDOM, a few seconds each. */
    pool?: readonly number[]
    /** Which way it faces (see characters/heading.ts). */
    heading: number
    /** Canvas size in pixels. */
    width: number
    height: number
    /** Shown this many times larger, pixels kept sharp. */
    scale?: number
  }>(),
  { scale: 1, pool: () => [] },
)

const CYCLE_MS = 2_400

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
let piece: CharacterPiece | null = null

function mount() {
  piece?.dispose()
  piece = canvas.value ? new CharacterPiece(props.npc, canvas.value) : null
}

onMounted(mount)
// The canvas resizes (and clears) before the watcher runs, so the new piece draws afresh.
watch(() => [props.npc, props.width, props.height], mount, { flush: 'post' })
onBeforeUnmount(() => piece?.dispose())
useRafFn(() => {
  const now = performance.now()
  const pool = props.anim === RANDOM ? props.pool : []
  const anim = pool[Math.floor(now / CYCLE_MS) % pool.length] ?? props.anim
  piece?.draw({ anim, since: 0, rate: 1 }, props.heading, now)
})
</script>

<template>
  <div class="relative">
    <canvas
      ref="canvas"
      class="character-preview"
      :width="width"
      :height="height"
      :style="{ width: `${width * scale}px`, height: `${height * scale}px` }"
    />
    <!-- Marks a style left to chance, so the cycling isn't taken for one odd animation. -->
    <TtIcon
      v-if="anim === RANDOM"
      name="mystery-box"
      :scale="1 / 3"
      title="Random: a new pick every move"
      class="random-badge"
    />
  </div>
</template>

<style scoped>
.character-preview {
  display: block;
  image-rendering: pixelated;
}
.random-badge {
  position: absolute;
  top: 2px;
  right: 2px;
}
</style>
