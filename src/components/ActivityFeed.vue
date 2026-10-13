<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import filterIcon from '@/assets/tt/img/icons/account-management.png'
import type { FeedItem } from '@/domain/activity'
import { observationText } from '@/domain/describe'
import { NO_FILTER, feedRows, type FeedFilter } from '@/domain/feed'
import type { Team } from '@/domain/game'
import type { TeamId } from '@/domain/ids'
import { useGameStore } from '@/stores/game'
import { teamColor } from '@/ui/colors'
import { formatGp, timeFrom } from '@/ui/format'
import { TtPanel, TtText, TtTooltip, stack } from '@/ui/tt'

const props = defineProps<{
  feed: readonly FeedItem[]
  teams: ReadonlyMap<TeamId, Team>
  now: Date
}>()

// While shown, the feed stays live; other views skip refetching it on every drop.
onBeforeUnmount(useGameStore().watchFeed())

const filter = reactive<FeedFilter>({ ...NO_FILTER })
const expanded = ref(new Set<string>())
/**
 * Rows are one line, cut short with the whole text on hover. Touch screens can't hover, so there
 * a tap opens the row in full instead, and another tap closes it.
 */
const canHover = window.matchMedia?.('(hover: hover)').matches ?? true
const openRow = ref<string | null>(null)
const toggleRow = (key: string) => {
  if (!canHover) openRow.value = openRow.value === key ? null : key
}
const showFilters = ref(false)

const rows = computed(() => feedRows(props.feed, filter, expanded.value))
const active = computed(() => filter.teamId !== null || filter.rsn !== '')

const colorOf = (id: TeamId | null) => {
  const team = id === null ? undefined : props.teams.get(id)
  return team ? teamColor(team) : 'var(--text-muted)'
}

type Part = { text: string; color: string; bold?: boolean }

/** A row's pieces in order, coloured: who, what, how many and what it was worth. */
function rowParts(item: FeedItem, count: number, value: number): Part[] {
  const parts: Part[] = [
    { text: item.rsn, color: colorOf(item.teamId), bold: true },
    { text: observationText(item.observation), color: 'white' },
  ]
  if (count > 1) parts.push({ text: `x${count}`, color: 'muted' })
  if (value > 0) parts.push({ text: `(${formatGp(value)})`, color: stack(value).color })
  return parts
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
      <li v-for="(row, i) in rows" :key="row.key" class="flex flex-col">
        <!-- One line: who, what, how many and what it was worth, then when. Hover shows it whole. -->
        <TtTooltip
          v-if="row.kind === 'item'"
          as="div"
          class="flex items-baseline gap-1.5"
          :disabled="!canHover"
          :max-width="280"
          @click="toggleRow(row.key)"
        >
          <p class="min-w-0 flex-1" :class="openRow === row.key ? 'break-words' : 'truncate'">
            <template v-for="(part, p) in rowParts(row.item, row.count, row.value)" :key="p">
              {{ p > 0 ? ' ' : ''
              }}<TtText :size="1" :font="part.bold ? 'bold' : undefined" :color="part.color">{{
                part.text
              }}</TtText>
            </template>
          </p>
          <time class="feed-time shrink-0" :datetime="row.item.at.toISOString()">
            {{ timeFrom(row.item.at, now) }}
          </time>
          <template #tip>
            <template v-for="(part, p) in rowParts(row.item, row.count, row.value)" :key="p">
              {{ p > 0 ? ' ' : ''
              }}<TtText :size="1" :font="part.bold ? 'bold' : undefined" :color="part.color">{{
                part.text
              }}</TtText>
            </template>
            <span class="feed-time block">{{ row.item.at.toLocaleString() }}</span>
          </template>
        </TtTooltip>
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
/* When it happened, small at the end of the row: the native 16px step of the pixel font. */
.feed-time {
  color: var(--text-muted);
  font-family: var(--font-small);
  font-size: 16px;
  line-height: 1;
  text-shadow: 1px 1px 0 #000;
}
</style>
