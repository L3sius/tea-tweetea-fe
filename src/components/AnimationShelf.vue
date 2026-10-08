<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import { loadAnimationInfo, type AnimationInfo } from '@/characters/assets'
import { ROSTER } from '@/characters/roster'
import CharacterPreview from './CharacterPreview.vue'

// What a character does on its own: the reactions to moments on the board, picked from these pools
// when they happen, and the rare idle emotes. Shown on the chosen NPC so they can be checked.

defineProps<{ npc: number; heading: number }>()

const SHELVES = [
  { label: 'Tile completed', ids: ROSTER.reactions.celebrate },
  { label: 'Joker drawn', ids: ROSTER.reactions.despair },
  { label: 'Arriving by teleport', ids: ROSTER.reactions.arrive },
  { label: 'Frozen', ids: ROSTER.reactions.frozen },
  { label: 'Item used', ids: ROSTER.reactions.use_item },
  { label: 'Passing a team', ids: ROSTER.reactions.pass },
  { label: 'Caught by a trap', ids: ROSTER.reactions.slip },
  { label: 'Idle easter eggs', ids: ROSTER.easterEggs.idle },
]

const info = shallowRef(new Map<number, AnimationInfo>())
onMounted(async () => {
  info.value = await loadAnimationInfo()
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <section v-for="shelf in SHELVES" :key="shelf.label">
      <h3 class="tt-bold" style="color: var(--osrs-orange)">{{ shelf.label }}</h3>
      <div class="flex flex-wrap gap-1.5">
        <figure v-for="id in shelf.ids" :key="id" class="tt-1 flex flex-col items-center">
          <CharacterPreview :npc="npc" :anim="id" :heading="heading" :width="44" :height="56" />
          <figcaption class="text-center" style="color: var(--text-muted)">
            {{ id }}<br />{{ info.get(id)?.name ?? '' }}
          </figcaption>
        </figure>
      </div>
    </section>
  </div>
</template>
