<script setup lang="ts">
import type { PropType } from 'vue'

defineProps({
  /** yellow = move click, red = a click that did nothing. */
  color: { type: String as PropType<'yellow' | 'red'>, default: 'yellow' },
  /** Centre position in px inside a relatively positioned parent. */
  x: { type: Number, default: undefined },
  y: { type: Number, default: undefined },
  size: { type: Number, default: 48 },
  /** Change to replay the 4-frame animation. */
  playKey: { type: [String, Number], default: undefined },
})
/** The four frames have played; the animation holds the last one, so the parent removes it. */
const emit = defineEmits<{ done: [] }>()
</script>

<template>
  <span
    :key="playKey"
    aria-hidden="true"
    :class="['tt-sprite', `tt-click-${color}`]"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      pointerEvents: 'none',
      ...(x != null && y != null
        ? { position: 'absolute', left: `${x - size / 2}px`, top: `${y - size / 2}px` }
        : {}),
    }"
    @animationend="emit('done')"
  />
</template>
