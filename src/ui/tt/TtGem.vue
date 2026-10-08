<script setup lang="ts">
import { computed, type PropType } from 'vue'
import type { Gem } from '@/domain/vocabulary'
import { GEM_NAMES } from './util'

const props = defineProps({
  gem: { type: String as PropType<Gem>, default: 'blue' },
  /** Integer pixel multiplier on the 21x23 sprite. */
  scale: { type: Number, default: 3 },
  held: { type: Boolean, default: true },
  glow: { type: Boolean, default: true },
  label: Boolean,
})
const name = computed(() => GEM_NAMES[props.gem])
const style = computed(() => {
  const s = props.scale
  const f = [`drop-shadow(${s}px ${s}px 0 #000)`]
  if (!props.held) f.unshift('grayscale(1) brightness(.35)')
  else if (props.glow) f.push(`drop-shadow(0 0 ${3 * s}px var(--gem-${props.gem}-glow))`)
  return {
    width: `${21 * s}px`,
    height: `${23 * s}px`,
    filter: f.join(' '),
    opacity: props.held ? 1 : 0.8,
  }
})
</script>

<template>
  <span
    style="
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
    "
  >
    <span
      role="img"
      :aria-label="held ? name : `${name} (missing)`"
      :title="held ? name : `${name} (missing)`"
      :class="['tt-sprite', `tt-gem-${gem}`]"
      :style="style"
    />
    <span
      v-if="label"
      :style="{
        fontFamily: 'var(--font-small)',
        fontSize: 'var(--fs-1)',
        lineHeight: 1,
        color: held ? 'var(--osrs-white)' : 'var(--text-muted)',
        textShadow: '1px 1px 0 #000',
      }"
      >{{ name }}</span
    >
  </span>
</template>
