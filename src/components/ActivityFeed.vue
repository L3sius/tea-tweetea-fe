<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { FeedItem, ObservationKind } from '@/domain/activity'
import { observationText } from '@/domain/describe'
import { NO_FILTER, feedRows, type FeedFilter } from '@/domain/feed'
import type { Team } from '@/domain/game'
import type { TeamId } from '@/domain/ids'
import { teamColor } from '@/ui/colors'
import { formatGp, timeFrom } from '@/ui/format'

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
  return team ? teamColor(team) : '#64748b'
}

function expand(rsn: string) {
  expanded.value = new Set([...expanded.value, rsn])
}

function reset() {
  Object.assign(filter, NO_FILTER)
}
</script>

<template>
  <section class="flex min-h-0 flex-col">
    <header class="flex items-center gap-2 border-b border-slate-800 px-4 py-2">
      <h2 class="font-semibold">Drops and kills</h2>
      <button
        type="button"
        class="ml-auto rounded px-2 py-0.5 text-xs hover:bg-slate-800"
        :class="active ? 'text-amber-300' : 'text-slate-400'"
        :aria-expanded="showFilters"
        @click="showFilters = !showFilters"
      >
        Filter{{ active ? ' •' : '' }}
      </button>
    </header>
    <div
      v-if="showFilters"
      class="grid grid-cols-2 gap-2 border-b border-slate-800 bg-slate-950/40 px-4 py-2 text-xs"
    >
      <select
        v-model="filter.teamId"
        class="rounded border border-slate-700 bg-slate-900 px-2 py-1"
        aria-label="Team"
      >
        <option :value="null">All teams</option>
        <option v-for="team in teams.values()" :key="team.id" :value="team.id">
          {{ team.name }}
        </option>
      </select>
      <select
        v-model="filter.kind"
        class="rounded border border-slate-700 bg-slate-900 px-2 py-1"
        aria-label="Kind"
      >
        <option v-for="k in KINDS" :key="k.label" :value="k.value">{{ k.label }}</option>
      </select>
      <input
        v-model="filter.rsn"
        type="search"
        placeholder="Player"
        aria-label="Player name"
        class="rounded border border-slate-700 bg-slate-900 px-2 py-1"
      />
      <select
        v-model.number="filter.minValue"
        class="rounded border border-slate-700 bg-slate-900 px-2 py-1"
        aria-label="Minimum value"
      >
        <option v-for="v in VALUES" :key="v.value" :value="v.value">{{ v.label }}</option>
      </select>
      <button
        v-if="active"
        type="button"
        class="col-span-2 text-left text-slate-400 underline"
        @click="reset"
      >
        Clear filters
      </button>
    </div>
    <p v-if="rows.length === 0" class="px-4 py-6 text-sm text-slate-500">
      {{ active ? 'Nothing matches these filters.' : 'No activity yet.' }}
    </p>
    <ol v-else class="min-h-0 flex-1 divide-y divide-slate-800/70 overflow-y-auto">
      <template v-for="row in rows" :key="row.key">
        <li v-if="row.kind === 'item'" class="flex items-baseline gap-3 px-4 py-2 text-sm">
          <span
            class="size-2 shrink-0 translate-y-[-1px] rounded-full"
            :style="{ backgroundColor: colorOf(row.item.teamId) }"
            aria-hidden="true"
          />
          <span class="flex-1 text-slate-300">
            <strong class="font-semibold text-slate-100">{{ row.item.rsn }}</strong>
            {{ observationText(row.item.observation) }}
            <span v-if="row.count > 1" class="text-slate-500">×{{ row.count }}</span>
          </span>
          <span v-if="row.value > 0" class="shrink-0 font-medium text-amber-300 tabular-nums">
            {{ formatGp(row.value) }}
          </span>
          <time
            class="w-14 shrink-0 text-right text-xs text-slate-500"
            :datetime="row.item.at.toISOString()"
            :title="row.item.at.toLocaleString()"
          >
            {{ timeFrom(row.item.at, now) }}
          </time>
        </li>
        <li v-else class="px-4 py-1.5 text-xs">
          <button
            type="button"
            class="text-slate-400 hover:text-slate-200"
            @click="expand(row.rsn)"
          >
            <span :style="{ color: colorOf(row.teamId) }">●</span>
            +{{ row.hidden.length }} more from {{ row.rsn }}
          </button>
        </li>
      </template>
    </ol>
  </section>
</template>
