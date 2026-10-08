<script setup lang="ts">
import { computed } from 'vue'
import { COLORS, FONTS } from './util'

const props = defineProps({
  as: { type: String, default: 'span' },
  /** Pixel-font multiplier: 1 = 16px … 6 = 96px. Whole numbers only. */
  size: { type: Number, default: 2 },
  font: { type: String, default: 'small' },
  /** A palette name (yellow, white, orange, …) or any CSS colour. */
  color: { type: String, default: 'yellow' },
  glow: Boolean,
  align: { type: String, default: 'center' },
  block: Boolean,
})

const style = computed(() => {
  const s = props.size
  const c = COLORS[props.color] ?? props.color
  const sh = `${s}px ${s}px 0 #000`
  return {
    fontFamily: FONTS[props.font] ?? props.font,
    // Size 1 is the readable small size (20px); larger sizes keep the font's 16px steps.
    fontSize: s === 1 ? 'var(--fs-1)' : `${16 * s}px`,
    lineHeight: 1.125,
    color: c,
    textShadow: props.glow ? `${sh}, 0 0 ${4 * s}px ${c}` : sh,
    textAlign: props.align as 'center',
    display: props.block ? 'block' : undefined,
    margin: 0,
    fontWeight: 'normal',
    textWrap: 'pretty' as const,
  }
})
</script>

<template>
  <component :is="as" :style="style"><slot /></component>
</template>
