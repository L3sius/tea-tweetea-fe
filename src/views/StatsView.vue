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
import { TtButton, TtDisplayBox, TtPanel, TtText } from '@/ui/tt'

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
    {
      label: 'Loot value',
      value: formatGp((k.loot?.value ?? 0) + (k.clue?.value ?? 0)),
      color: 'var(--osrs-cash)',
    },
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
    <div class="mx-auto flex max-w-[1440px] flex-col gap-1.5">
      <TtPanel variant="iron" :padding="6" :gap="9">
        <TtText as="h2" :size="3" font="quill" color="orange" glow>Statistics</TtText>
        <div class="flex flex-wrap items-center justify-center gap-1.5">
          <select v-model="filter.kind" class="tt-input" aria-label="Activity">
            <option v-for="k in KINDS" :key="k.label" :value="k.value">{{ k.label }}</option>
          </select>
          <select v-model="filter.teamId" class="tt-input" aria-label="Team">
            <option :value="null">All teams</option>
            <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
          <div class="flex gap-1" role="group" aria-label="Rank by">
            <TtButton
              v-for="m in ['value', 'count'] as const"
              :key="m"
              size="sm"
              :selected="effectiveMeasure === m"
              :aria-pressed="effectiveMeasure === m"
              :disabled="m === 'value' && effectiveMeasure === 'count' && measure === 'value'"
              @click="measure = m"
            >
              {{ m === 'value' ? 'GP value' : 'Count' }}
            </TtButton>
          </div>
          <TtText v-if="loading" :size="1" color="muted">Updating...</TtText>
        </div>
        <TtText v-if="error" role="alert" :size="1" color="red">{{ error }}</TtText>
        <dl class="flex flex-wrap justify-center gap-1.5">
          <TtDisplayBox
            v-for="t in tiles"
            :key="t.label"
            :label="t.label"
            :value="t.value"
            :value-color="t.color"
            :width="174"
          />
        </dl>
      </TtPanel>

      <div class="grid gap-1.5 lg:grid-cols-2">
        <TtPanel title="By team" :padding="12">
          <BarList :rows="byTeam" />
          <table class="tt-1 w-full">
            <caption class="pb-1" style="color: var(--osrs-orange)">
              On the board
            </caption>
            <thead style="color: var(--osrs-orange)">
              <tr>
                <th class="text-left font-normal">Team</th>
                <th class="text-right font-normal">Gems</th>
                <th class="text-right font-normal">Tiles</th>
                <th class="text-right font-normal">Gold</th>
                <th class="text-right font-normal">Cards left</th>
              </tr>
            </thead>
            <tbody style="color: var(--osrs-white)">
              <tr v-for="r in gameRows" :key="r.id">
                <td class="tt-bold py-0.5 text-left" :style="{ color: r.color }">{{ r.name }}</td>
                <td class="text-right">{{ r.gems }}</td>
                <td class="text-right">{{ r.tiles }}</td>
                <td class="text-right" style="color: var(--osrs-yellow)">{{ r.gold }}</td>
                <td class="text-right">{{ r.cards }}</td>
              </tr>
            </tbody>
          </table>
        </TtPanel>

        <TtPanel :title="kindInfo.subject" :padding="12">
          <BarList :rows="bySubject" />
        </TtPanel>

        <TtPanel title="Top players" :padding="12">
          <BarList :rows="byAccount" />
        </TtPanel>

        <TtPanel title="Activity per hour" :padding="12">
          <HourChart :rows="tables?.hour ?? []" :measure="effectiveMeasure" />
        </TtPanel>
      </div>
    </div>
  </div>
</template>
