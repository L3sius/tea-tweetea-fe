<script setup lang="ts">
import { computed, useSlots } from 'vue'
import TtText from './TtText.vue'
import { px } from './util'

const props = defineProps({
  /** stone = side-panel frame; iron = riveted frame for emphasis and modals. */
  variant: { type: String, default: 'stone' },
  title: { type: String, default: undefined },
  width: { type: [Number, String], default: undefined },
  height: { type: [Number, String], default: undefined },
  padding: { type: Number, default: 18 },
  gap: { type: Number, default: 12 },
})
const slots = useSlots()
const hasTitle = computed(() => props.title != null || !!slots.title)
const iron = computed(() => props.variant === 'iron')
</script>

<template>
  <div
    :class="iron ? 'tt-frame-iron' : 'tt-frame-stone'"
    :style="{
      width: px(width),
      height: px(height),
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: hasTitle ? 'flex-start' : 'center',
    }"
  >
    <div
      v-if="hasTitle"
      style="width: 100%; display: flex; flex-direction: column; align-items: center"
    >
      <TtText as="h2" :size="2" font="bold" color="orange" style="padding: 6px 12px 3px">
        <slot name="title">{{ title }}</slot>
      </TtText>
      <div :class="iron ? 'tt-divider-iron-h' : 'tt-divider-h'" style="width: 100%" />
    </div>
    <div
      :style="{
        flex: hasTitle ? 1 : 'none',
        width: '100%',
        boxSizing: 'border-box',
        padding: `${padding}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: hasTitle ? 'flex-start' : 'center',
        gap: `${gap}px`,
        textAlign: 'center',
      }"
    >
      <slot />
    </div>
  </div>
</template>
