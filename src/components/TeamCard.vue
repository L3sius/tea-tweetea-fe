<script setup lang="ts">
import { computed } from 'vue'
import type { Challenge } from '@/domain/challenge'
import {
  challengeProgress,
  effortText,
  itemName,
  teamStatusText,
  type Names,
} from '@/domain/describe'
import type { GameState, Team } from '@/domain/game'
import type { ChallengeId } from '@/domain/ids'
import { itemEntry } from '@/domain/items'
import { GEMS, type Item } from '@/domain/vocabulary'
import { teamColor } from '@/ui/colors'
import { count } from '@/ui/format'
import { TtGemTracker, TtProgressBar, TtText } from '@/ui/tt'
import ItemSlot from './ItemSlot.vue'
import PlayingCard from './PlayingCard.vue'

const props = defineProps<{
  team: Team
  state: GameState
  challenges: ReadonlyMap<ChallengeId, Challenge>
  names: Names
  now: Date
  /** The team's items, which are private: only given to someone logged in as this team. */
  items: ReadonlyMap<Item, number> | null
  /** The team's piece is still walking on the map; its new status would spoil where it ends. */
  moving?: boolean
}>()

const color = computed(() => teamColor(props.team))
const statusText = computed(() =>
  props.moving ? 'Walking...' : teamStatusText(props.team, props.now),
)

/** The tile task the team is working on, with how far along it is. */
const task = computed(() => {
  const { status, id } = props.team
  if (status.kind !== 'working' || props.moving) return null
  const instance = props.state.instances.get(status.instanceId)
  const challenge = instance && props.challenges.get(instance.challengeId)
  if (!challenge) return null
  const effort = effortText(challenge, instance, instance.progress.get(id), props.now)
  return { challenge, effort, ...challengeProgress(challenge, instance, id) }
})

/** The team's items, each with what it does, for the hover box. */
const items = computed(() =>
  [...(props.items ?? [])]
    .filter(([, count]) => count > 0)
    .map(([item, count]) => ({
      item,
      count,
      name: itemName(item),
      text: itemEntry(item).description,
    })),
)
</script>

<template>
  <article class="flex w-full flex-col items-center gap-1.5">
    <header class="flex flex-wrap items-baseline justify-center gap-x-3">
      <TtText as="h3" :size="2" font="bold" :color="color" class="[overflow-wrap:anywhere]">
        {{ team.name }}
      </TtText>
      <TtText :size="1" color="white">
        {{ team.gems.size }} / {{ GEMS.length }} gems · {{ team.gold }} gold ·
        {{ count(team.tilesCompleted, 'tile') }}
      </TtText>
    </header>

    <TtGemTracker :held="team.gems" :scale="1.5" :slots="false" />

    <div class="flex items-center justify-center gap-3">
      <PlayingCard
        v-if="team.status.kind === 'drawn' && !moving"
        :card="team.status.card"
        size="sm"
      />
      <TtText :size="1">{{ statusText }}</TtText>
    </div>
    <template v-if="task">
      <TtText :size="1" color="white">{{ task.challenge.name }}</TtText>
      <TtText v-if="task.challenge.description" :size="1" color="muted">
        {{ task.challenge.description }}
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
      <TtText v-if="task.effort" :size="1" color="muted">{{ task.effort }}</TtText>
    </template>

    <!-- Pictures, not names: hover (or tap) one for what it does. -->
    <ul v-if="items.length" class="flex flex-wrap justify-center gap-1" aria-label="Items">
      <li
        v-for="i in items"
        :key="i.item"
        class="item"
        tabindex="0"
        :aria-label="`${i.name}: ${i.text}`"
      >
        <ItemSlot :item="i.item" :count="i.count" :size="74" hint="" />
        <span class="item-tip" role="tooltip">
          <span class="item-tip-name">{{ i.name }}</span>
          {{ i.text }}
        </span>
      </li>
    </ul>
  </article>
</template>

<style scoped>
/* What an item does, in the game's examine-box style, over the item while hovered or focused. */
.item {
  position: relative;
  outline: none;
}
.item-tip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  z-index: 20;
  display: none;
  width: max-content;
  max-width: 220px;
  padding: 4px 8px;
  border: 3px solid #000;
  background: var(--tooltip-bg);
  box-shadow: 4px 4px 0 #000;
  color: var(--osrs-white);
  font-family: var(--font-small);
  font-size: var(--fs-1);
  line-height: 1.15;
  text-align: center;
  text-shadow: 1px 1px 0 #000;
  transform: translateX(-50%);
  pointer-events: none;
}
.item-tip-name {
  display: block;
  color: var(--osrs-orange);
}
.item:hover .item-tip,
.item:focus-visible .item-tip,
.item:focus .item-tip {
  display: block;
}
</style>
