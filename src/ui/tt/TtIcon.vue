<script setup lang="ts">
import { computed } from 'vue'
import { ICON_SIZES } from './util'

const props = defineProps({
  name: { type: String, required: true },
  /** Multiplier on the 3px-art-pixel size; keep to multiples of 1/3. */
  scale: { type: Number, default: 1 },
  shadow: { type: Boolean, default: true },
  title: { type: String, default: undefined },
})
const style = computed(() => {
  const [w, h] = ICON_SIZES[props.name] ?? [48, 48]
  return {
    width: `${Math.round(w * props.scale)}px`,
    height: `${Math.round(h * props.scale)}px`,
    filter: props.shadow ? 'drop-shadow(3px 3px 0 #000)' : undefined,
  }
})
</script>

<template>
  <span
    role="img"
    :aria-label="title || name"
    :title="title"
    :class="['tt-sprite', `tt-icon-${name}`]"
    :style="style"
  />
</template>
