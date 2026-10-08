<script setup lang="ts">
import { px } from './util'

defineProps({
  label: { type: [String, Number], default: undefined },
  value: { type: [String, Number], default: undefined },
  valueColor: { type: String, default: 'var(--osrs-white)' },
  width: { type: [Number, String], default: undefined },
  height: { type: [Number, String], default: undefined },
})
</script>

<template>
  <div
    class="tt-sprite-display"
    :style="{
      width: px(width),
      height: px(height),
      minWidth: '120px',
      minHeight: '66px',
      boxSizing: 'border-box',
      padding: '3px 9px',
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '3px',
      textAlign: 'center',
    }"
  >
    <span
      v-if="label != null"
      style="
        font-family: var(--font-small);
        font-size: var(--fs-1);
        line-height: 1;
        color: var(--osrs-orange);
        text-shadow: 1px 1px 0 #000;
      "
      >{{ label }}</span
    >
    <span
      v-if="value != null"
      :style="{
        fontFamily: 'var(--font-small)',
        fontSize: '32px',
        lineHeight: 1,
        color: valueColor,
        textShadow: '2px 2px 0 #000',
      }"
      >{{ value }}</span
    >
    <slot />
  </div>
</template>
