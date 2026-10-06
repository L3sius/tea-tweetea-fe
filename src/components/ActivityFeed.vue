<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { FeedItem, ObservationKind } from '@/domain/activity'
import { observationText } from '@/domain/describe'
import { NO_FILTER, feedRows, type FeedFilter } from '@/domain/feed'
import type { Team } from '@/domain/game'
import type { TeamId } from '@/domain/ids'
import { teamColor } from '@/ui/colors'
import { formatGp, timeFrom } from '@/ui/format'
import { TtButton, TtDivider, TtPanel, TtText, stack } from '@/ui/tt'

const props = defineProps<{
  feed: readonly FeedItem[]
  teams: ReadonlyMap<TeamId, Team>
  now: Date
}>()

const filter = reactive<FeedFilter>({ ...NO_FILTER })
const expanded = ref(new Set<string>())
const showFilters = ref(false)

const KINDS: { value: ObservationKind | null; label: string }[] = [
  { value: null, label: 'Everything' },
  { value: 'loot', label: 'Drops' },
  { value: 'kill_count', label: 'Kills' },
  { value: 'clue', label: 'Clues' },
  { value: 'pet', label: 'Pets' },
  { value: 'slayer', label: 'Slayer' },
  { value: 'combat_achievement', label: 'Combat achievements' },
]
const VALUES = [
  { value: 0, label: 'Any value' },
  { value: 100_000, label: '100k+' },
  { value: 1_000_000, label: '1m+' },
  { value: 10_000_000, label: '10m+' },
]

const rows = computed(() => feedRows(props.feed, filter, expanded.value))
const active = computed(
  () => filter.teamId !== null || filter.kind !== null || filter.rsn !== '' || filter.minValue > 0,
)

const colorOf = (id: TeamId | null) => {
  const team = id === null ? undefined : props.teams.get(id)
  return team ? teamColor(team) : 'var(--text-muted)'
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
    <TtButton
      size="sm"
      :selected="showFilters"
      :aria-expanded="showFilters"
      @click="showFilters = !showFilters"
    >
      Filter{{ active ? ' (on)' : '' }}
    </TtButton>
    <div v-if="showFilters" class="grid w-full grid-cols-2 gap-1.5">
      <select v-model="filter.teamId" class="tt-input" aria-label="Team">
        <option :value="null">All teams</option>
        <option v-for="team in teams.values()" :key="team.id" :value="team.id">
          {{ team.name }}
        </option>
      </select>
      <select v-model="filter.kind" class="tt-input" aria-label="Kind">
        <option v-for="k in KINDS" :key="k.label" :value="k.value">{{ k.label }}</option>
      </select>
      <input
        v-model="filter.rsn"
        type="search"
        placeholder="Player"
        aria-label="Player name"
        class="tt-input"
      />
      <select v-model.number="filter.minValue" class="tt-input" aria-label="Minimum value">
        <option v-for="v in VALUES" :key="v.value" :value="v.value">{{ v.label }}</option>
      </select>
      <button v-if="active" type="button" class="tt-link tt-1 col-span-2" @click="reset">
        Clear filters
      </button>
    </div>

    <TtText v-if="rows.length === 0" :size="1" color="muted">
      {{ active ? 'Nothing matches these filters.' : 'No activity yet.' }}
    </TtText>
    <ol v-else class="flex w-full flex-col gap-1.5">
      <li v-for="(row, i) in rows" :key="row.key" class="flex flex-col items-center gap-1.5">
        <p v-if="row.kind === 'item'" class="flex flex-wrap items-baseline justify-center gap-x-2">
          <time :datetime="row.item.at.toISOString()" :title="row.item.at.toLocaleString()">
            <TtText :size="1" color="muted">{{ timeFrom(row.item.at, now) }}</TtText>
          </time>
          <TtText :size="1" font="bold" :color="colorOf(row.item.teamId)">{{
            row.item.rsn
          }}</TtText>
          <TtText :size="1" color="white">{{ observationText(row.item.observation) }}</TtText>
          <TtText v-if="row.count > 1" :size="1" color="muted">x{{ row.count }}</TtText>
          <TtText v-if="row.value > 0" :size="1" :color="stack(row.value).color">
            ({{ formatGp(row.value) }})
          </TtText>
        </p>
        <button v-else type="button" class="tt-link tt-1" @click="expand(row.rsn)">
          <span :style="{ color: colorOf(row.teamId) }">{{ row.rsn }}</span
          >: {{ row.hidden.length }} more
        </button>
        <TtDivider v-if="i < rows.length - 1" length="80%" style="opacity: 0.6" />
      </li>
    </ol>
  </TtPanel>
</template>
