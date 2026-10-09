<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { loadAnimationInfo, type AnimationInfo } from '@/characters/assets'
import { ROSTER } from '@/characters/roster'
import { TtButton } from '@/ui/tt'
import CharacterPreview from './CharacterPreview.vue'

// What a character does on its own: the reactions to moments on the board, picked from these pools
// when they happen, and the rare idle emotes. One moment at a time, shown on the chosen NPC, so the
// section stays short and only a few previews animate at once.

defineProps<{ npc: number; heading: number }>()

const SHELVES = [
  { label: 'Tile completed', ids: ROSTER.reactions.celebrate },
  { label: 'Joker drawn', ids: ROSTER.reactions.despair },
  { label: 'Teleport landing', ids: ROSTER.reactions.arrive },
  { label: 'Frozen', ids: ROSTER.reactions.frozen },
  { label: 'Item used', ids: ROSTER.reactions.use_item },
  { label: 'Passing a team', ids: ROSTER.reactions.pass },
  { label: 'Caught by a blocker', ids: ROSTER.reactions.slip },
  { label: 'Idle emotes', ids: ROSTER.easterEggs.idle },
]

const shown = ref(0)
const shelf = computed(() => SHELVES[shown.value] ?? SHELVES[0])

const info = shallowRef(new Map<number, AnimationInfo>())
onMounted(async () => {
  info.value = await loadAnimationInfo()
})

/** The animation's id and cache name, for the hover text. */
const hint = (id: number) => [`#${id}`, info.value.get(id)?.name].filter(Boolean).join(' ')
</script>

<template>
  <div class="flex w-full flex-col items-center gap-2">
    <div class="flex flex-wrap justify-center gap-1" role="group" aria-label="Moment">
      <TtButton
        v-for="(s, i) in SHELVES"
        :key="s.label"
        size="sm"
        class="!min-w-0"
        :selected="shown === i"
        :aria-pressed="shown === i"
        @click="shown = i"
      >
        {{ s.label }} ({{ s.ids.length }})
      </TtButton>
    </div>
    <div v-if="shelf" class="flex flex-wrap justify-center gap-1.5">
      <figure v-for="id in shelf.ids" :key="id" class="m-0" :title="hint(id)">
        <CharacterPreview
          :npc="npc"
          :anim="id"
          :heading="heading"
          :width="44"
          :height="56"
          :scale="2"
        />
      </figure>
    </div>
  </div>
</template>
