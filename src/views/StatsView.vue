<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import BarList, { type BarRow } from '@/components/BarList.vue'
import HourChart from '@/components/HourChart.vue'
import type { ObservationKind, StatRow } from '@/domain/activity'
import { teamId } from '@/domain/ids'
import { useGameStore } from '@/stores/game'
import { useStatsStore } from '@/stores/stats'
import { teamColor } from '@/ui/colors'
import { formatGp } from '@/ui/format'

const game = useGameStore()
const stats = useStatsStore()
const { filter, tables, loading, error } = storeToRefs(stats)

onMounted(stats.open)
onUnmounted(stats.close)

const measure = ref<'value' | 'count'>('value')

const KINDS: { value: ObservationKind | null; label: string; subject: string }[] = [
  { value: null, label: 'All activity', subject: 'Top sources' },
  { value: 'loot', label: 'Drops', subject: 'Top loot sources' },
  { value: 'kill_count', label: 'Boss kills', subject: 'Bosses' },
  { value: 'clue', label: 'Clues', subject: 'Clue tiers' },
  { value: 'pet', label: 'Pets', subject: 'Pets' },
  { value: 'slayer', label: 'Slayer', subject: 'Slayer tasks' },
  { value: 'combat_achievement', label: 'Combat achievements', subject: 'Tasks' },
]
const kindInfo = computed(
  () => KINDS.find((k) => k.value === filter.value.kind) ?? { subject: 'Top sources' },
)

/** Kill counts and pets have no gp value, so they always rank by count. */
const effectiveMeasure = computed(() =>
  filter.value.kind && !['loot', 'clue'].includes(filter.value.kind) ? 'count' : measure.value,
)

const teams = computed(() => [...(game.state?.teams.values() ?? [])])
const teamOfAccount = computed(() => {
  const out = new Map<string, (typeof teams.value)[number]>()
  for (const team of teams.value)
    for (const member of team.members) for (const rsn of member.accounts) out.set(rsn, team)
  return out
})

function toBars(
  rows: readonly StatRow[],
  label: (r: StatRow) => string,
  color?: (r: StatRow) => string | undefined,
): BarRow[] {
  const m = effectiveMeasure.value
  return [...rows]
    .sort((a, b) => b[m] - a[m])
    .filter((r) => r[m] > 0)
    .map((r) => ({
      key: r.key,
      label: label(r),
      value: r[m],
      display: m === 'value' ? formatGp(r.value) : r.count.toLocaleString(),
      note: m === 'value' ? `${r.count} events` : r.value ? formatGp(r.value) : undefined,
      color: color?.(r),
    }))
}

const byTeam = computed(() =>
  toBars(
    tables.value?.team ?? [],
    (r) => game.names.team(teamId(Number(r.key))),
    (r) => {
      const team = game.state?.teams.get(teamId(Number(r.key)))
      return team ? teamColor(team) : undefined
    },
  ),
)
const bySubject = computed(() => toBars(tables.value?.subject ?? [], (r) => r.key).slice(0, 15))
const byAccount = computed(() =>
  toBars(
    tables.value?.account ?? [],
    (r) => r.key,
    (r) => {
      const team = teamOfAccount.value.get(r.key)
      return team ? teamColor(team) : undefined
    },
  ).slice(0, 15),
)

const tiles = computed(() => {
  const k = tables.value?.kinds
  if (!k) return []
  const accounts = tables.value?.account.length ?? 0
  return [
    { label: 'Loot value', value: formatGp((k.loot?.value ?? 0) + (k.clue?.value ?? 0)) },
    { label: 'Drops', value: (k.loot?.count ?? 0).toLocaleString() },
    { label: 'Boss kills', value: (k.kill_count?.count ?? 0).toLocaleString() },
    { label: 'Clues', value: (k.clue?.count ?? 0).toLocaleString() },
    { label: 'Pets', value: (k.pet?.count ?? 0).toLocaleString() },
    { label: 'Active accounts', value: accounts.toLocaleString() },
  ]
})

/** Game stats from the state rather than Dink: gems, tiles, gold. */
const gameRows = computed(() =>
  [...(game.standings ?? [])].map((t) => ({
    id: t.id,
    name: t.name,
    color: teamColor(t),
    gems: t.gems.size,
    tiles: t.tilesCompleted,
    gold: t.gold,
    cards: t.cardsLeft,
  })),
)
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto flex max-w-6xl flex-col gap-5 p-4 lg:p-6">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="mr-auto text-xl font-bold text-slate-100">Statistics</h2>
        <select v-model="filter.kind" class="stat-select" aria-label="Activity">
          <option v-for="k in KINDS" :key="k.label" :value="k.value">{{ k.label }}</option>
        </select>
        <select v-model="filter.teamId" class="stat-select" aria-label="Team">
          <option :value="null">All teams</option>
          <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <div
          class="flex overflow-hidden rounded-md border border-slate-700 text-xs"
          role="group"
          aria-label="Rank by"
        >
          <button
            v-for="m in ['value', 'count'] as const"
            :key="m"
            type="button"
            class="px-2.5 py-1.5"
            :class="effectiveMeasure === m ? 'bg-slate-700 text-slate-100' : 'text-slate-400'"
            :disabled="m === 'value' && effectiveMeasure === 'count' && measure === 'value'"
            @click="measure = m"
          >
            {{ m === 'value' ? 'GP value' : 'Count' }}
          </button>
        </div>
        <span v-if="loading" class="text-xs text-slate-500">Updating…</span>
      </div>
      <p v-if="error" role="alert" class="text-sm text-red-300">{{ error }}</p>

      <dl class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div
          v-for="t in tiles"
          :key="t.label"
          class="rounded-xl border border-slate-800 bg-slate-900/70 p-3"
        >
          <dt class="text-xs text-slate-400">{{ t.label }}</dt>
          <dd class="text-2xl font-bold text-slate-100 tabular-nums">{{ t.value }}</dd>
        </div>
      </dl>

      <div class="grid gap-5 lg:grid-cols-2">
        <section class="stat-card">
          <h3 class="stat-title">By team</h3>
          <BarList :rows="byTeam" />
          <table class="mt-4 w-full text-sm">
            <caption class="mb-1 text-left text-xs text-slate-500">
              On the board
            </caption>
            <thead class="text-xs text-slate-400">
              <tr>
                <th class="text-left font-medium">Team</th>
                <th class="text-right font-medium">Gems</th>
                <th class="text-right font-medium">Tiles</th>
                <th class="text-right font-medium">Gold</th>
                <th class="text-right font-medium">Cards left</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in gameRows" :key="r.id" class="border-t border-slate-800">
                <td class="py-1 font-semibold" :style="{ color: r.color }">{{ r.name }}</td>
                <td class="text-right tabular-nums">{{ r.gems }}</td>
                <td class="text-right tabular-nums">{{ r.tiles }}</td>
                <td class="text-right text-amber-300 tabular-nums">{{ r.gold }}</td>
                <td class="text-right tabular-nums">{{ r.cards }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="stat-card">
          <h3 class="stat-title">{{ kindInfo.subject }}</h3>
          <BarList :rows="bySubject" />
        </section>

        <section class="stat-card">
          <h3 class="stat-title">Top players</h3>
          <BarList :rows="byAccount" />
        </section>

        <section class="stat-card">
          <h3 class="stat-title">Activity per hour</h3>
          <HourChart :rows="tables?.hour ?? []" :measure="effectiveMeasure" />
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference '../assets/main.css';

.stat-select {
  @apply rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm;
}
.stat-card {
  @apply rounded-xl border border-slate-800 bg-slate-900/70 p-4;
}
.stat-title {
  @apply mb-3 text-sm font-semibold tracking-wide text-amber-200 uppercase;
}
</style>
