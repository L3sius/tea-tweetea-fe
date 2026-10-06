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
    class="playing-card grid shrink-0 place-items-center"
    :class="[size === 'sm' ? 'h-12 w-9 text-base' : 'h-24 w-16 text-[32px]', { red }]"
    :aria-label="cardLabel(card)"
  >
    {{ card.kind === 'joker' ? 'Joker' : cardLabel(card) }}
  </div>
</template>

<style scoped>
.playing-card {
  border: 3px solid #000;
  background: #e8dcb8;
  box-shadow: 3px 3px 0 #000;
  color: #000;
  font-family: var(--font-bold);
  line-height: 1;
  text-shadow: none;
  animation: card-flip 0.6s steps(6, end);
}
.playing-card.red {
  color: #b00000;
}
@keyframes card-flip {
  from {
    transform: rotateY(90deg) scale(0.8);
  }
}
</style>
