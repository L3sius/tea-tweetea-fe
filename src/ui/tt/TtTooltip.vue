<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { nextTick, ref, useTemplateRef } from 'vue'

// The game's examine box: shown over its target while hovered or focused (a tap focuses it on touch
// screens). It is drawn on the page body, so scrolling panels don't clip it, above the target or
// below when there is no room, and kept inside the window.

const props = withDefaults(
  defineProps<{
    /** The element that wraps the target; attributes like tabindex land on it. */
    as?: string
    /** No box, for when the target already shows everything. */
    disabled?: boolean
    maxWidth?: number
  }>(),
  { as: 'span', disabled: false, maxWidth: 220 },
)

// Two roots (the target and the teleported box), so attributes are passed to the target by hand.
defineOptions({ inheritAttrs: false })

const GAP = 6
const MARGIN = 4

const anchor = useTemplateRef<HTMLElement>('anchor')
const tip = useTemplateRef<HTMLElement>('tip')
const open = ref(false)
const at = ref<{ left: number; top: number } | null>(null)

async function show() {
  if (props.disabled) return
  open.value = true
  at.value = null
  await nextTick()
  if (!anchor.value || !tip.value) return
  const target = anchor.value.getBoundingClientRect()
  const box = tip.value.getBoundingClientRect()
  const centred = target.left + target.width / 2 - box.width / 2
  const left = Math.min(Math.max(centred, MARGIN), window.innerWidth - box.width - MARGIN)
  const above = target.top - box.height - GAP
  at.value = { left, top: above >= MARGIN ? above : target.bottom + GAP }
}

function hide() {
  open.value = false
}

// A fixed box would stay put while its target scrolls away.
useEventListener(window, 'scroll', hide, { capture: true, passive: true })
</script>

<template>
  <component
    :is="as"
    ref="anchor"
    v-bind="$attrs"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot />
  </component>
  <Teleport to="body">
    <span
      v-if="open"
      ref="tip"
      role="tooltip"
      class="tt-tooltip"
      :style="{
        maxWidth: `${maxWidth}px`,
        left: `${at?.left ?? 0}px`,
        top: `${at?.top ?? 0}px`,
        visibility: at ? 'visible' : 'hidden',
      }"
    >
      <slot name="tip" />
    </span>
  </Teleport>
</template>

<style scoped>
.tt-tooltip {
  position: fixed;
  /* Over the header (1100), menus and dialogs (2000), under the tutorial's cover (3000). */
  z-index: 2500;
  display: block;
  width: max-content;
  padding: 4px 8px;
  border: 3px solid #000;
  background: var(--tooltip-bg);
  box-shadow: 4px 4px 0 #000;
  color: var(--osrs-white);
  font-family: var(--font-small);
  font-size: var(--fs-1);
  line-height: 1.15;
  text-align: center;
  text-shadow: 1px 1px 0 #000;
  pointer-events: none;
}
</style>
