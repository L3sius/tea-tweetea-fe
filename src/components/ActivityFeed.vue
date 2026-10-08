<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import filterIcon from '@/assets/tt/img/icons/account-management.png'
import type { FeedItem } from '@/domain/activity'
import { observationText } from '@/domain/describe'
import { NO_FILTER, feedRows, type FeedFilter } from '@/domain/feed'
import type { Team } from '@/domain/game'
import type { TeamId } from '@/domain/ids'
import { teamColor } from '@/ui/colors'
import { formatGp, timeFrom } from '@/ui/format'
import { TtPanel, TtText, stack } from '@/ui/tt'

const props = defineProps<{
  feed: readonly FeedItem[]
  teams: ReadonlyMap<TeamId, Team>
  now: Date
}>()

const filter = reactive<FeedFilter>({ ...NO_FILTER })
const expanded = ref(new Set<string>())
const showFilters = ref(false)

const rows = computed(() => feedRows(props.feed, filter, expanded.value))
const active = computed(() => filter.teamId !== null || filter.rsn !== '')

const colorOf = (id: TeamId | null) => {
  const team = id === null ? undefined : props.teams.get(id)
  return team ? teamColor(team) : 'var(--text-muted)'
}

/** The whole row as plain text, for the hover box when it is cut short. */
function rowText(item: FeedItem, count: number, value: number): string {
  const parts = [item.rsn, observationText(item.observation)]
  if (count > 1) parts.push(`x${count}`)
  if (value > 0) parts.push(`(${formatGp(value)})`)
  return parts.join(' ')
}

function expand(rsn: string) {
  expanded.value = new Set([...expanded.value, rsn])
}

function reset() {
  Object.assign(filter, NO_FILTER)
}
</script>

<template>
  <TtPanel title="Drops and kills" width="100%" :padding="12" :gap="9" class="min-h-full">
    <template #actions>
      <button
        type="button"
        class="filter-tab"
        :class="{ open: showFilters, on: active }"
        :title="active ? 'Filter (on)' : 'Filter'"
        :aria-label="active ? 'Filter, on' : 'Filter'"
        :aria-expanded="showFilters"
        @click="showFilters = !showFilters"
      >
        <img :src="filterIcon" alt="" width="27" height="27" draggable="false" />
      </button>
    </template>

    <div v-if="showFilters" class="grid w-full grid-cols-2 gap-1.5">
      <select v-model="filter.teamId" class="tt-input" aria-label="Team">
        <option :value="null">All teams</option>
        <option v-for="team in teams.values()" :key="team.id" :value="team.id">
          {{ team.name }}
        </option>
      </select>
      <input
        v-model="filter.rsn"
        type="search"
        placeholder="Player"
        aria-label="Player name"
        class="tt-input"
      />
      <button v-if="active" type="button" class="tt-link tt-1 col-span-2" @click="reset">
        Clear filters
      </button>
    </div>

    <TtText v-if="rows.length === 0" :size="1" color="muted">
      {{ active ? 'Nothing matches these filters.' : 'No activity yet.' }}
    </TtText>
    <ol v-else class="flex w-full flex-col gap-1.5 text-left">
      <li v-for="(row, i) in rows" :key="row.key" class="flex flex-col gap-0.5">
        <template v-if="row.kind === 'item'">
          <time
            class="feed-time"
            :datetime="row.item.at.toISOString()"
            :title="row.item.at.toLocaleString()"
          >
            {{ timeFrom(row.item.at, now) }}
          </time>
          <!-- One line: who, what, how many and what it was worth. Hover shows it whole. -->
          <p class="truncate" :title="rowText(row.item, row.count, row.value)">
            <TtText :size="1" font="bold" :color="colorOf(row.item.teamId)">{{
              row.item.rsn
            }}</TtText>
            {{ ' ' }}
            <TtText :size="1" color="white">{{ observationText(row.item.observation) }}</TtText>
            <template v-if="row.count > 1">
              {{ ' ' }}<TtText :size="1" color="muted">x{{ row.count }}</TtText>
            </template>
            <template v-if="row.value > 0">
              {{ ' '
              }}<TtText :size="1" :color="stack(row.value).color"
                >({{ formatGp(row.value) }})</TtText
              >
            </template>
          </p>
        </template>
        <button v-else type="button" class="tt-link tt-1 self-start" @click="expand(row.rsn)">
          <span :style="{ color: colorOf(row.teamId) }">{{ row.rsn }}</span
          >: {{ row.hidden.length }} more
        </button>
        <div v-if="i < rows.length - 1" class="tt-rule mt-1 w-full" />
      </li>
    </ol>
  </TtPanel>
</template>

<style scoped>
/* The filter toggle, drawn like an OSRS side-panel tab: red while its filters are open or set. */
.filter-tab {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 3px solid #000;
  background: var(--brown-deep);
  box-shadow: inset 2px 2px 0 rgb(255 255 255 / 0.08);
  cursor: pointer;
}
.filter-tab img {
  image-rendering: pixelated;
}
.filter-tab:hover {
  filter: brightness(1.18);
}
.filter-tab.open,
.filter-tab.on {
  background: #6b2a1f;
}
/* When it happened, small above the row: the native 16px step of the pixel font. */
.feed-time {
  color: var(--text-muted);
  font-family: var(--font-small);
  font-size: 16px;
  line-height: 1;
  text-shadow: 1px 1px 0 #000;
}
</style>
