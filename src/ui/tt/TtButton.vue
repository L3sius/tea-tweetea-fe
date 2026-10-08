<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import { px } from './util'

const props = defineProps({
  /** sm = small label (20px), md = 32px label. */
  size: { type: String as PropType<'sm' | 'md'>, default: 'md' },
  width: { type: [Number, String], default: undefined },
  selected: Boolean,
  disabled: Boolean,
  type: { type: String as PropType<'button' | 'submit'>, default: 'button' },
})

const emit = defineEmits<{ click: [e: MouseEvent] }>()

const hover = ref(false)
const down = ref(false)

const style = computed(() => {
  const sm = props.size === 'sm'
  return {
    width: px(props.width),
    minWidth: sm ? '96px' : '144px',
    minHeight: sm ? '48px' : '66px',
    boxSizing: 'border-box' as const,
    position: 'relative' as const,
    padding: sm ? '0 6px' : '0 12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: props.disabled ? 'default' : 'pointer',
    backgroundColor: 'transparent',
    outline: 'none',
    filter: props.disabled
      ? 'grayscale(1) brightness(.6)'
      : down.value
        ? 'brightness(.82)'
        : hover.value || props.selected
          ? 'brightness(1.18)'
          : undefined,
    fontFamily: 'var(--font-small)',
    fontSize: sm ? 'var(--fs-1)' : '32px',
    lineHeight: 1,
    textAlign: 'center' as const,
    color: props.disabled
      ? 'var(--text-muted)'
      : props.selected || hover.value
        ? 'var(--osrs-white)'
        : 'var(--osrs-yellow)',
    textShadow: sm ? '1px 1px 0 #000' : '2px 2px 0 #000',
  }
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="tt-sprite-button tt-press"
    :class="{ 'tt-pressed': selected && !disabled }"
    :style="style"
    @click="(e: MouseEvent) => emit('click', e)"
    @mouseenter="hover = true"
    @mouseleave="((hover = false), (down = false))"
    @mousedown="down = true"
    @mouseup="down = false"
  >
    <!-- Selected: the button's own outline turns yellow, its shadow left alone. -->
    <span v-if="selected" class="tt-select-ring" aria-hidden="true" />
    <span
      :style="{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
      }"
      ><slot
    /></span>
  </button>
</template>
