<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { px } from './util'

const props = defineProps({
  value: { type: Number, default: 0 },
  max: { type: Number, default: 1 },
  /** hp = green on red; gold = orange on dark; cash = cash-green on dark. */
  variant: { type: String as PropType<'hp' | 'gold' | 'cash'>, default: 'hp' },
  /** Any CSS colour for the fill, on the dark track (a team's colour). */
  color: { type: String, default: undefined },
  label: { type: String, default: undefined },
  width: { type: [Number, String], default: '100%' },
  height: { type: Number, default: 30 },
})
const FILLS = {
  hp: ['var(--hp-full)', 'var(--hp-empty)'],
  gold: ['var(--osrs-orange)', 'var(--brown-deep)'],
  cash: ['var(--osrs-cash)', 'var(--brown-deep)'],
} as const
const pct = computed(() => Math.max(0, Math.min(1, props.max ? props.value / props.max : 0)))
const fill = computed(() =>
  props.color ? [props.color, 'var(--brown-deep)'] : (FILLS[props.variant] ?? FILLS.hp),
)
</script>

<template>
  <div
    role="progressbar"
    :aria-valuenow="value"
    :aria-valuemax="max"
    :style="{
      width: px(width),
      height: `${height}px`,
      boxSizing: 'border-box',
      position: 'relative',
      background: fill[1],
      border: '3px solid #000',
      boxShadow: '3px 3px 0 #000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }"
  >
    <div
      :style="{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: `${pct * 100}%`,
        background: fill[0],
        transition: 'width 0.5s steps(6, end)',
      }"
    />
    <span
      v-if="label != null"
      style="
        position: relative;
        font-family: var(--font-small);
        font-size: var(--fs-1);
        line-height: 1;
        color: var(--osrs-white);
        text-shadow: 1px 1px 0 #000;
      "
      >{{ label }}</span
    >
  </div>
</template>
