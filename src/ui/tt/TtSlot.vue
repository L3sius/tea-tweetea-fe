<script setup lang="ts">
import { computed, ref, useAttrs } from 'vue'
import { stack } from './util'

const props = defineProps({
  icon: { type: String, default: undefined },
  /** A gem colour, drawn as its sprite. */
  gem: { type: String, default: undefined },
  /** Stack size; hidden when 1 or unset. */
  quantity: { type: Number, default: undefined },
  label: { type: String, default: undefined },
  selected: Boolean,
  empty: Boolean,
  size: { type: Number, default: 108 },
  title: { type: String, default: undefined },
})
const attrs = useAttrs()
const hover = ref(false)
const clickable = computed(() => !!attrs.onClick)
const q = computed(() =>
  props.quantity != null && props.quantity !== 1 ? stack(props.quantity) : null,
)
const iconFilter = computed(() =>
  [
    'drop-shadow(3px 3px 0 #000)',
    props.selected ? 'drop-shadow(0 0 0 #fff) drop-shadow(0 0 9px rgba(255,255,255,.6))' : null,
  ]
    .filter(Boolean)
    .join(' '),
)
const gemScale = computed(() => (props.size >= 96 ? 3 : 2))
</script>

<template>
  <div
    :title="title"
    class="tt-sprite-slot"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    :aria-pressed="clickable ? selected : undefined"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      boxSizing: 'border-box',
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 'none',
      cursor: clickable ? 'pointer' : undefined,
      filter: empty ? 'brightness(.7)' : hover && clickable ? 'brightness(1.12)' : undefined,
      boxShadow: selected ? '0 0 0 3px var(--osrs-white)' : undefined,
    }"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
    @keydown.enter.prevent="($event.currentTarget as HTMLElement).click()"
    @keydown.space.prevent="($event.currentTarget as HTMLElement).click()"
  >
    <span
      v-if="gem"
      :class="['tt-sprite', `tt-gem-${gem}`]"
      :style="{
        width: `${21 * gemScale}px`,
        height: `${23 * gemScale}px`,
        filter: iconFilter,
      }"
    />
    <span
      v-if="icon"
      :class="['tt-sprite', `tt-icon-${icon}`]"
      :style="{
        width: `${size - 36}px`,
        height: `${size - 36}px`,
        backgroundSize: 'contain',
        filter: iconFilter,
      }"
    />
    <slot />
    <span
      v-if="q"
      :style="{
        position: 'absolute',
        top: '-9px',
        left: '-6px',
        fontFamily: 'var(--font-small)',
        fontSize: '32px',
        lineHeight: 1,
        color: q.color,
        textShadow: '2px 2px 0 #000',
      }"
      >{{ q.text }}</span
    >
    <span
      v-if="label != null"
      style="
        position: absolute;
        bottom: -9px;
        left: 0;
        right: 0;
        text-align: center;
        font-family: var(--font-small);
        font-size: 16px;
        line-height: 1;
        color: var(--osrs-white);
        text-shadow: 1px 1px 0 #000;
      "
      >{{ label }}</span
    >
  </div>
</template>
