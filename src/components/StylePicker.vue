<script setup lang="ts">
import { computed } from 'vue'
import { RANDOM, type StyleOption } from '@/characters/roster'
import CharacterPreview from './CharacterPreview.vue'

// One style's options, each playing on the chosen NPC; click one to pick it. With `random`, a last
// option leaves the choice to chance on every move, and its preview runs through the others.

const props = defineProps<{
  npc: number
  options: readonly StyleOption[]
  heading: number
  random?: boolean
}>()
const model = defineModel<number>({ required: true })

const pool = computed(() => props.options.map((o) => o.id))
const shown = computed(() =>
  props.random ? [...props.options, { id: RANDOM, label: 'Random' }] : props.options,
)
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <button
      v-for="option in shown"
      :key="option.id"
      type="button"
      class="style-option tt-1 flex flex-col items-center"
      :class="{ 'style-option-on': model === option.id }"
      :aria-pressed="model === option.id"
      @click="model = option.id"
    >
      <CharacterPreview
        :npc="npc"
        :anim="option.id"
        :pool="pool"
        :heading="heading"
        :width="44"
        :height="56"
        :scale="2"
      />
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.style-option {
  padding: 4px;
  color: var(--osrs-yellow);
  border: 2px solid transparent;
}
.style-option:hover {
  background: rgb(255 255 255 / 0.06);
}
.style-option-on {
  color: var(--osrs-white);
  border-color: var(--osrs-orange);
  background: rgb(255 152 31 / 0.15);
}
</style>
