<script setup lang="ts">
import { computed } from 'vue'
import type { Challenge } from '@/domain/challenge'
import { challengeProgress, itemName, teamStatusText, type Names } from '@/domain/describe'
import type { GameState, Team } from '@/domain/game'
import type { ChallengeId } from '@/domain/ids'
import { GEMS } from '@/domain/vocabulary'
import { teamColor } from '@/ui/colors'
import { TtButton, TtGemTracker, TtProgressBar, TtText } from '@/ui/tt'
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
  props.moving ? 'Walking...' : teamStatusText(props.team, props.now, props.names),
)

/** The tile task the team is working on, with how far along it is. */
const task = computed(() => {
  const { status, id } = props.team
  if (status.kind !== 'working' || props.moving) return null
  const instance = props.state.instances.get(status.instanceId)
  const challenge = instance && props.challenges.get(instance.challengeId)
  if (!challenge) return null
  return { challenge, ...challengeProgress(challenge, instance, id) }
})

const items = computed(() =>
  [...props.team.items]
    .filter(([, count]) => count > 0)
    .map(([item, count]) => (count > 1 ? `${itemName(item)} x${count}` : itemName(item))),
)
</script>

<template>
  <article class="flex w-full flex-col items-center gap-1.5">
    <header class="flex flex-wrap items-baseline justify-center gap-x-3">
      <TtText :size="2" color="orange">{{ rank }}.</TtText>
      <TtText as="h3" :size="2" font="bold" :color="color">{{ team.name }}</TtText>
      <TtText :size="1" color="white">
        {{ team.gems.size }} / {{ GEMS.length }} gems · {{ team.gold }} gold ·
        {{ team.tilesCompleted }} tiles · {{ team.cardsLeft }} cards
      </TtText>
    </header>

    <TtGemTracker :held="team.gems" :scale="1" :slots="false" />

    <div class="flex items-center justify-center gap-3">
      <PlayingCard
        v-if="team.status.kind === 'drawn' && !moving"
        :card="team.status.card"
        size="sm"
      />
      <TtText :size="1">{{ statusText }}</TtText>
    </div>
    <template v-if="task">
      <TtText :size="1" color="white" :title="task.challenge.description">
        {{ task.challenge.name }}
      </TtText>
      <TtProgressBar
        :value="task.done"
        :max="task.needed"
        :color="color"
        :label="`${task.done} / ${task.needed}`"
        :width="300"
        :height="24"
        class="max-w-full"
      />
    </template>

    <TtText v-if="items.length" :size="1" color="cyan" aria-label="Items">
      {{ items.join(', ') }}
    </TtText>

    <TtText :size="1" color="muted">
      <span
        v-for="(member, i) in team.members"
        :key="member.name"
        :title="member.accounts.join(', ')"
      >
        {{ member.name }}<template v-if="i < team.members.length - 1">, </template>
      </span>
    </TtText>
    <TtButton size="sm" @click="emit('locate', team)">Follow</TtButton>
  </article>
</template>
