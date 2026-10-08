<script setup lang="ts">
import type { StyleOption } from '@/characters/roster'
import CharacterPreview from './CharacterPreview.vue'

// One style's options, each playing on the chosen NPC; click one to pick it.

defineProps<{
  npc: number
  options: readonly StyleOption[]
  heading: number
}>()
const model = defineModel<number>({ required: true })
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <button
      v-for="option in options"
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
