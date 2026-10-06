<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { cardLabel } from '@/domain/describe'
import type { Card } from '@/domain/game'

const props = defineProps<{
  /** The card the server dealt; the picked card flips over to it once it arrives. */
  result: Card | null
  disabled?: boolean
}>()
const emit = defineEmits<{ pick: []; revealed: [] }>()

/** Face-down cards on the table. Which one is picked is for show: the server deals the card. */
const FAN = 7
/** The picked card lifts for at least this long before flipping, so the reveal has a beat. */
const SUSPENSE_MS = 900

const chosen = ref<number | null>(null)
const flipped = ref(false)
let pickedAt = 0
let timer: ReturnType<typeof setTimeout> | undefined

function pick(i: number) {
  if (chosen.value !== null || props.disabled) return
  chosen.value = i
  pickedAt = Date.now()
  emit('pick')
}

watch(
  () => props.result,
  (card) => {
    if (!card || chosen.value === null) return
    const wait = Math.max(0, SUSPENSE_MS - (Date.now() - pickedAt))
    timer = setTimeout(() => {
      flipped.value = true
      timer = setTimeout(() => emit('revealed'), 650)
    }, wait)
  },
)
onBeforeUnmount(() => clearTimeout(timer))

/** The server refused the draw: put the card back. */
function reset() {
  chosen.value = null
  flipped.value = false
}
defineExpose({ reset })

const red = computed(
  () =>
    props.result?.kind === 'suited' &&
    (props.result.suit === 'hearts' || props.result.suit === 'diamonds'),
)
const SUITS = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' } as const
const FACES: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }
const rank = computed(() =>
  props.result?.kind === 'suited' ? (FACES[props.result.rank] ?? String(props.result.rank)) : '',
)
const suit = computed(() => (props.result?.kind === 'suited' ? SUITS[props.result.suit] : ''))

/** Fan geometry: spread around the centre, slightly arched. */
function fanStyle(i: number) {
  const mid = (FAN - 1) / 2
  const offset = i - mid
  return {
    '--x': `${offset * 34}px`,
    '--y': `${Math.abs(offset) ** 1.6 * 3}px`,
    '--r': `${offset * 7}deg`,
    '--delay': `${i * 60}ms`,
  }
}
</script>

<template>
  <div class="draw-table" :class="{ 'has-choice': chosen !== null }">
    <button
      v-for="i in FAN"
      :key="i"
      type="button"
      class="draw-card"
      :class="{
        chosen: chosen === i - 1,
        dropped: chosen !== null && chosen !== i - 1,
        waiting: chosen === i - 1 && !flipped,
        flipped: chosen === i - 1 && flipped,
      }"
      :style="fanStyle(i - 1)"
      :disabled="disabled || (chosen !== null && chosen !== i - 1)"
      :aria-label="
        chosen === i - 1 && flipped && result ? cardLabel(result) : `Face-down card ${i}`
      "
      @click="pick(i - 1)"
    >
      <span class="draw-card-inner">
        <span class="draw-card-back" aria-hidden="true"><span>🐤</span></span>
        <span class="draw-card-face" :class="red ? 'text-red-600' : 'text-slate-900'">
          <template v-if="result?.kind === 'suited'">
            <span class="corner top">{{ rank }}<br />{{ suit }}</span>
            <span class="pip">{{ suit }}</span>
            <span class="big">{{ rank }}</span>
            <span class="corner bottom">{{ rank }}<br />{{ suit }}</span>
          </template>
          <template v-else-if="result">
            <span class="pip joker">🃏</span>
            <span class="big text-fuchsia-700">JOKER</span>
          </template>
        </span>
      </span>
    </button>
  </div>
</template>

<style scoped>
.draw-table {
  position: relative;
  height: 170px;
  perspective: 900px;
}
.draw-card {
  position: absolute;
  left: 50%;
  top: 24px;
  width: 72px;
  height: 104px;
  margin-left: -36px;
  border-radius: 10px;
  transform: translate(var(--x), var(--y)) rotate(var(--r));
  transition:
    transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 0.35s;
  animation: deal 0.5s backwards cubic-bezier(0.2, 0.8, 0.2, 1);
  animation-delay: var(--delay);
  cursor: pointer;
}
@keyframes deal {
  from {
    transform: translate(0, -40px) rotate(0deg) scale(0.8);
    opacity: 0;
  }
}
.draw-card:not(:disabled):hover,
.draw-card:not(:disabled):focus-visible {
  transform: translate(var(--x), calc(var(--y) - 14px)) rotate(var(--r));
  outline: none;
}
.draw-card:not(:disabled):focus-visible .draw-card-back {
  box-shadow: 0 0 0 3px #fbbf24;
}
.draw-table .draw-card.chosen {
  z-index: 10;
  transform: translate(0, -14px) scale(1.25);
  cursor: default;
}
.draw-card.dropped {
  opacity: 0;
  transform: translate(var(--x), calc(var(--y) + 40px)) rotate(var(--r)) scale(0.9);
  cursor: default;
}
.draw-card.waiting .draw-card-inner {
  animation: wobble 0.5s ease-in-out infinite;
}
@keyframes wobble {
  25% {
    transform: rotate(-3deg);
  }
  75% {
    transform: rotate(3deg);
  }
}
.draw-card-inner {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.3, 0.7, 0.3, 1);
}
.draw-card.flipped .draw-card-inner {
  transform: rotateY(180deg);
}
.draw-card-back,
.draw-card-face {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  backface-visibility: hidden;
  box-shadow: 0 6px 16px rgb(0 0 0 / 0.45);
}
.draw-card-back {
  display: grid;
  place-items: center;
  border: 3px solid #f8fafc;
  background: repeating-linear-gradient(45deg, #6d28d9 0 6px, #7c3aed 6px 12px), #6d28d9;
  font-size: 26px;
}
.draw-card-back span {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 9999px;
  background: #fef3c7;
}
.draw-card-face {
  display: grid;
  place-items: center;
  border: 2px solid #cbd5e1;
  background: #f8fafc;
  transform: rotateY(180deg);
  font-weight: 900;
}
.draw-card-face .pip {
  font-size: 34px;
  line-height: 1;
  margin-top: -14px;
}
.draw-card-face .pip.joker {
  font-size: 40px;
}
.draw-card-face .big {
  position: absolute;
  bottom: 16px;
  font-size: 22px;
}
.draw-card-face .corner {
  position: absolute;
  font-size: 11px;
  line-height: 1;
  text-align: center;
}
.draw-card-face .corner.top {
  top: 5px;
  left: 6px;
}
.draw-card-face .corner.bottom {
  right: 6px;
  bottom: 5px;
  transform: rotate(180deg);
}
@media (prefers-reduced-motion: reduce) {
  .draw-card,
  .draw-card-inner {
    animation: none !important;
    transition-duration: 0.01s !important;
  }
}
</style>
