<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { GEMS, type Gem } from '@/domain/vocabulary'
import TtGem from './TtGem.vue'

const props = defineProps({
  /** Gems the team holds. */
  held: { type: Object as PropType<ReadonlySet<Gem>>, required: true },
  scale: { type: Number, default: 2 },
  /** Sit each gem in a slot tile. */
  slots: { type: Boolean, default: true },
})
const size = computed(() => `${props.scale * 23 + 39}px`)
</script>

<template>
  <div
    :aria-label="`${held.size} of ${GEMS.length} gems`"
    :style="{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: slots ? '3px' : `${3 * scale}px`,
    }"
  >
    <template v-for="g in GEMS" :key="g">
      <div
        v-if="slots"
        class="tt-sprite-slot"
        :style="{
          width: size,
          height: size,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }"
      >
        <TtGem :gem="g" :scale="scale" :held="held.has(g)" />
      </div>
      <TtGem v-else :gem="g" :scale="scale" :held="held.has(g)" />
    </template>
  </div>
</template>
