<script setup lang="ts">
import { computed } from 'vue'
import { cardLabel } from '@/domain/describe'
import type { Card } from '@/domain/game'

const props = defineProps<{ card: Card; size?: 'sm' | 'lg' }>()

const red = computed(
  () =>
    props.card.kind === 'suited' &&
    (props.card.suit === 'hearts' || props.card.suit === 'diamonds'),
)
</script>

<template>
  <div
    class="card-flip grid shrink-0 place-items-center rounded-lg border-2 border-slate-300 bg-slate-50 font-black shadow-lg"
    :class="[
      size === 'sm' ? 'h-12 w-9 text-sm' : 'h-24 w-16 text-2xl',
      red ? 'text-red-600' : 'text-slate-900',
    ]"
    :aria-label="cardLabel(card)"
  >
    {{ card.kind === 'joker' ? '🃏' : cardLabel(card) }}
  </div>
</template>

<style scoped>
.card-flip {
  animation: card-flip 0.6s ease-out;
}
@keyframes card-flip {
  from {
    transform: rotateY(90deg) scale(0.8);
  }
}
</style>
