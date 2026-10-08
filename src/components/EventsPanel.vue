<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Challenge } from '@/domain/challenge'
import { contests } from '@/domain/contests'
import type { Names } from '@/domain/describe'
import type { GameState } from '@/domain/game'
import type { ChallengeId } from '@/domain/ids'
import { timeFrom } from '@/ui/format'
import { TtPanel, TtText } from '@/ui/tt'
import ContestCard from './ContestCard.vue'

const props = defineProps<{
  state: GameState
  challenges: ReadonlyMap<ChallengeId, Challenge>
  names: Names
  now: Date
}>()

const open = ref<string | null>(null)
const toggle = (key: string) => (open.value = open.value === key ? null : key)
/** Finished minigames and matches stay out of the way until asked for. */
const showResults = ref(false)

const all = computed(() =>
  contests({ state: props.state, challenges: props.challenges, names: props.names }),
)
</script>

<template>
  <TtPanel title="Minigames" width="100%" :padding="12" :gap="12">
    <TtText v-if="all.live.length === 0" :size="1" color="muted">
      No minigames or matches right now. Landing on a red tile opens one.
    </TtText>
    <ContestCard
      v-for="c in all.live"
      :key="c.key"
      :contest="c"
      :teams="state.teams"
      :names="names"
      :now="now"
    />

    <button
      v-if="all.past.length"
      type="button"
      class="tt-link tt-1"
      :aria-expanded="showResults"
      @click="showResults = !showResults"
    >
      {{ showResults ? 'Hide' : 'Show' }} finished ({{ all.past.length }})
    </button>
    <ul v-if="showResults" class="flex w-full flex-col gap-1">
      <li v-for="c in all.past" :key="c.key" class="flex flex-col items-center gap-1">
        <button
          type="button"
          class="tt-link flex w-full flex-wrap items-baseline justify-center gap-x-2"
          :aria-expanded="open === c.key"
          @click="toggle(c.key)"
        >
          <TtText :size="1" color="muted">{{ c.kind === 'match' ? 'Match' : 'Minigame' }}</TtText>
          <TtText :size="1" :color="open === c.key ? 'white' : 'yellow'">{{ c.title }}</TtText>
          <TtText :size="1" color="muted">{{ timeFrom(c.deadline, now) }}</TtText>
        </button>
        <ContestCard
          v-if="open === c.key"
          :contest="c"
          :teams="state.teams"
          :names="names"
          :now="now"
        />
      </li>
    </ul>
  </TtPanel>
</template>
