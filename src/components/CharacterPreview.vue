<script setup lang="ts">
import { useRafFn } from '@vueuse/core'
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { CharacterPiece } from '@/characters/stage'

const props = withDefaults(
  defineProps<{
    npc: number
    /** The animation it loops. */
    anim: number
    /** Which way it faces (see characters/heading.ts). */
    heading: number
    /** Canvas size in pixels. */
    width: number
    height: number
    /** Shown this many times larger, pixels kept sharp. */
    scale?: number
  }>(),
  { scale: 1 },
)

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
useRafFn(() =>
  piece?.draw({ anim: props.anim, since: 0, rate: 1 }, props.heading, performance.now()),
)
</script>

<template>
  <canvas
    ref="canvas"
    class="character-preview"
    :width="width"
    :height="height"
    :style="{ width: `${width * scale}px`, height: `${height * scale}px` }"
  />
</template>

<style scoped>
.character-preview {
  display: block;
  image-rendering: pixelated;
}
</style>
