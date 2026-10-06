<script setup lang="ts">
import { computed } from 'vue'
import type { Challenge } from '@/domain/challenge'
import { challengeProgress, itemName, teamStatusText, type Names } from '@/domain/describe'
import type { GameState, Team } from '@/domain/game'
import type { ChallengeId } from '@/domain/ids'
import { GEMS } from '@/domain/vocabulary'
import { teamColor } from '@/ui/colors'
import GemRow from './GemRow.vue'
import PlayingCard from './PlayingCard.vue'

const props = defineProps<{
  team: Team
  rank: number
  state: GameState
  challenges: ReadonlyMap<ChallengeId, Challenge>
  names: Names
  now: Date
  /** The team's piece is still walking on the map; its new status would spoil where it ends. */
  moving?: boolean
}>()
const emit = defineEmits<{ locate: [team: Team] }>()

const color = computed(() => teamColor(props.team))
const statusText = computed(() =>
  props.moving ? 'On the move…' : teamStatusText(props.team, props.now, props.names),
)

/** The tile task the team is working on, with how far along it is. */
const task = computed(() => {
  const { status, id } = props.team
  if (status.kind !== 'working' || props.moving) return null
  const instance = props.state.instances.get(status.instanceId)
  const challenge = instance && props.challenges.get(instance.challengeId)
  if (!challenge) return null
  const progress = challengeProgress(challenge, instance, id)
  return { challenge, ...progress, percent: Math.round((progress.done / progress.needed) * 100) }
})

const items = computed(() => [...props.team.items].filter(([, count]) => count > 0))
</script>

<template>
  <article
    class="flex flex-col gap-3 rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-lg"
    :style="{ borderTopColor: color, borderTopWidth: '4px' }"
  >
    <header class="flex items-center gap-3">
      <span class="text-sm font-semibold text-slate-500 tabular-nums">#{{ rank }}</span>
      <h2 class="text-lg font-bold" :style="{ color }">{{ team.name }}</h2>
      <span class="ml-auto text-sm text-slate-400 tabular-nums">
        {{ team.gems.size }}/{{ GEMS.length }} gems
      </span>
    </header>

    <GemRow :gems="team.gems" />

    <dl class="grid grid-cols-3 gap-2 text-center">
      <div class="rounded-lg bg-slate-800/70 py-1.5">
        <dt class="text-xs text-slate-400">Gold</dt>
        <dd class="font-semibold text-amber-300 tabular-nums">{{ team.gold }}</dd>
      </div>
      <div class="rounded-lg bg-slate-800/70 py-1.5">
        <dt class="text-xs text-slate-400">Tiles done</dt>
        <dd class="font-semibold tabular-nums">{{ team.tilesCompleted }}</dd>
      </div>
      <div class="rounded-lg bg-slate-800/70 py-1.5">
        <dt class="text-xs text-slate-400">Cards left</dt>
        <dd class="font-semibold tabular-nums">{{ team.cardsLeft }}</dd>
      </div>
    </dl>

    <div class="text-sm">
      <div class="flex items-center gap-3">
        <PlayingCard
          v-if="team.status.kind === 'drawn' && !moving"
          :card="team.status.card"
          size="sm"
        />
        <p class="text-slate-300">{{ statusText }}</p>
      </div>
      <div v-if="task" class="mt-2">
        <div class="flex justify-between gap-2 text-xs">
          <span class="font-medium text-slate-200" :title="task.challenge.description">
            {{ task.challenge.name }}
          </span>
          <span class="shrink-0 text-slate-400 tabular-nums"
            >{{ task.done }}/{{ task.needed }}</span
          >
        </div>
        <div
          class="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800"
          role="progressbar"
          :aria-valuenow="task.percent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="h-full rounded-full transition-[width] duration-500"
            :style="{ width: `${task.percent}%`, backgroundColor: color }"
          />
        </div>
      </div>
    </div>

    <ul v-if="items.length > 0" class="flex flex-wrap gap-1.5" aria-label="Items">
      <li
        v-for="[item, count] in items"
        :key="item"
        class="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
      >
        {{ itemName(item) }}<span v-if="count > 1" class="text-slate-500"> ×{{ count }}</span>
      </li>
    </ul>

    <footer class="mt-auto flex items-end justify-between gap-2 pt-1">
      <p class="text-xs text-slate-500">
        <span
          v-for="(member, i) in team.members"
          :key="member.name"
          :title="member.accounts.join(', ')"
        >
          {{ member.name }}<template v-if="i < team.members.length - 1">, </template>
        </span>
      </p>
      <button
        type="button"
        class="shrink-0 rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
        @click="emit('locate', team)"
      >
        Follow
      </button>
    </footer>
  </article>
</template>
