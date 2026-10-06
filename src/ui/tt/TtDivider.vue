<script setup lang="ts">
import { computed } from 'vue'
import { px } from './util'

const props = defineProps({
  orientation: { type: String, default: 'horizontal' },
  variant: { type: String, default: 'stone' },
  length: { type: [Number, String], default: '100%' },
})
const h = computed(() => props.orientation === 'horizontal')
const cls = computed(() =>
  props.variant === 'iron'
    ? h.value
      ? 'tt-divider-iron-h'
      : 'tt-divider-iron-v'
    : h.value
      ? 'tt-divider-h'
      : 'tt-divider-v',
)
</script>

<template>
  <div
    :class="cls"
    role="separator"
    :style="{ [h ? 'width' : 'height']: px(length), flex: 'none', alignSelf: 'center' }"
  />
</template>
