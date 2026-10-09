<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { FAKE_PICKS, reelProgress, reelStrip } from '@/ui/reel'

// A slot-machine reel: picks scroll from left to right past the marker and stop on `winner`. The
// winner is decided before it starts (by the server); the spin is only for show. Picks show as
// text, or through the `pick` slot (an item's picture, say).

const props = withDefaults(
  defineProps<{
    winner: string
    durationMs?: number
    /** What the reel scrolls past on its way to the winner. */
    fakes?: readonly string[]
  }>(),
  { durationMs: 6000, fakes: () => FAKE_PICKS },
)
const emit = defineEmits<{ landed: [] }>()
defineSlots<{ pick?: (props: { label: string }) => unknown }>()
/** Width of one pick on the strip, gap included. */
const PICK = 232

const strip = reelStrip(props.winner, undefined, props.fakes)
const view = useTemplateRef('view')
const offset = ref(0)
const landed = ref(false)

/** The strip's shift that puts pick `at` (fractional) under the marker. */
function shiftFor(at: number) {
  const width = view.value?.clientWidth ?? 0
  return width / 2 - (at * PICK + PICK / 2)
}

let frame = 0
onMounted(() => {
  const started = performance.now()
  const tick = (now: number) => {
    const t = (now - started) / props.durationMs
    const at = strip.start - (strip.start - strip.winner) * reelProgress(t)
    offset.value = shiftFor(at)
    if (t < 1) frame = requestAnimationFrame(tick)
    else {
      landed.value = true
      emit('landed')
    }
  }
  frame = requestAnimationFrame(tick)
})
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <div ref="view" class="reel" :class="{ landed }">
    <ol class="reel-strip" :style="{ transform: `translateX(${offset}px)` }" aria-hidden="true">
      <li
        v-for="(label, i) in strip.labels"
        :key="i"
        class="reel-pick"
        :class="{ win: landed && i === strip.winner }"
      >
        <slot name="pick" :label="label">{{ label }}</slot>
      </li>
    </ol>
    <!-- The marker the reel stops on: a line behind the picks, and notches over them. -->
    <div class="reel-marker" aria-hidden="true" />
    <div class="reel-notches" aria-hidden="true" />
    <p class="sr-only" aria-live="polite">{{ landed ? winner : 'Picking…' }}</p>
  </div>
</template>

<style scoped>
.reel {
  position: relative;
  width: 100%;
  height: 92px;
  overflow: hidden;
  border: 3px solid #000;
  background: var(--brown-deep);
  box-shadow: inset 0 0 18px rgb(0 0 0 / 0.8);
}
.reel-strip {
  position: absolute;
  z-index: 1;
  top: 10px;
  left: 0;
  display: flex;
  gap: 12px;
  padding: 0 6px;
  will-change: transform;
}
.reel-pick {
  box-sizing: border-box;
  display: grid;
  place-items: center;
  flex: none;
  width: 220px;
  height: 66px;
  padding: 4px 10px;
  border: 3px solid #000;
  background: var(--brown-2);
  box-shadow: inset 0 0 0 2px var(--stone-hi);
  color: var(--osrs-yellow);
  font-family: var(--font-small);
  font-size: var(--fs-1);
  line-height: 1.1;
  text-align: center;
  text-shadow: 1px 1px 0 #000;
}
.reel-pick.win {
  border-color: var(--osrs-yellow);
  color: var(--osrs-white);
  box-shadow:
    inset 0 0 0 2px var(--osrs-yellow),
    0 0 14px var(--osrs-yellow);
}
/* A gold line down the middle, behind the picks so it never covers their text. */
.reel-marker,
.reel-notches {
  position: absolute;
  inset: 0 auto 0 50%;
  width: 3px;
  transform: translateX(-50%);
  pointer-events: none;
}
.reel-marker {
  background: var(--osrs-yellow);
  box-shadow: 0 0 6px var(--osrs-yellow);
}
/* Gold notches top and bottom, over the picks, point at the one under the marker. */
.reel-notches {
  z-index: 2;
}
.reel-notches::before,
.reel-notches::after {
  content: '';
  position: absolute;
  left: 50%;
  border: 9px solid transparent;
  transform: translateX(-50%);
}
.reel-notches::before {
  top: 0;
  border-top-color: var(--osrs-yellow);
}
.reel-notches::after {
  bottom: 0;
  border-bottom-color: var(--osrs-yellow);
}
/* The sides fade, so picks slide in and out of the dark. */
.reel::after {
  content: '';
  position: absolute;
  z-index: 3;
  inset: 0;
  background: linear-gradient(
    to right,
    var(--brown-deep),
    transparent 22%,
    transparent 78%,
    var(--brown-deep)
  );
  pointer-events: none;
}
</style>
