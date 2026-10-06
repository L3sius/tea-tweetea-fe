<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted } from 'vue'
import GemRow from '@/components/GemRow.vue'
import { useGameStore } from '@/stores/game'
import { useStatsStore } from '@/stores/stats'
import { teamColor } from '@/ui/colors'
import { formatGp } from '@/ui/format'

const game = useGameStore()
const stats = useStatsStore()
const { standings } = storeToRefs(game)

// Per-account numbers for everything, whatever filter the stats page was left on.
onMounted(() => {
  stats.filter = { kind: null, teamId: null }
  stats.open()
})
onUnmounted(stats.close)

const byAccount = computed(() => new Map((stats.tables?.account ?? []).map((r) => [r.key, r])))

const rosters = computed(() =>
  standings.value.map((team) => {
    const members = team.members.map((m) => {
      const accounts = m.accounts.map((rsn) => ({
        rsn,
        alt: rsn !== m.name,
        count: byAccount.value.get(rsn)?.count ?? 0,
        value: byAccount.value.get(rsn)?.value ?? 0,
      }))
      return {
        name: m.name,
        accounts,
        count: accounts.reduce((a, x) => a + x.count, 0),
        value: accounts.reduce((a, x) => a + x.value, 0),
      }
    })
    return {
      team,
      color: teamColor(team),
      members,
      accounts: members.reduce((a, m) => a + m.accounts.length, 0),
      value: members.reduce((a, m) => a + m.value, 0),
    }
  }),
)
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto flex max-w-6xl flex-col gap-5 p-4 lg:p-6">
      <h2 class="text-xl font-bold text-slate-100">Teams and rosters</h2>
      <p class="-mt-3 text-sm text-slate-400">
        Every account a player’s Dink reports come from counts for their team, alts included.
      </p>
      <div class="grid gap-5 md:grid-cols-2">
        <article
          v-for="r in rosters"
          :key="r.team.id"
          class="rounded-xl border border-slate-800 bg-slate-900/70 p-4"
          :style="{ borderTopColor: r.color, borderTopWidth: '4px' }"
        >
          <header class="flex flex-wrap items-center gap-3">
            <h3 class="text-lg font-bold" :style="{ color: r.color }">{{ r.team.name }}</h3>
            <GemRow :gems="r.team.gems" />
            <span class="ml-auto text-xs text-slate-400">
              {{ r.members.length }} players · {{ r.accounts }} accounts ·
              <span class="text-amber-300">{{ formatGp(r.value) }}</span>
            </span>
          </header>
          <table class="mt-3 w-full text-sm">
            <thead class="text-xs text-slate-400">
              <tr>
                <th class="text-left font-medium">Player / account</th>
                <th class="text-right font-medium">Events</th>
                <th class="text-right font-medium">Loot</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="m in r.members" :key="m.name">
                <tr class="border-t border-slate-800">
                  <td class="py-1.5 font-semibold text-slate-100">{{ m.name }}</td>
                  <td class="text-right tabular-nums">{{ m.count }}</td>
                  <td class="text-right text-amber-300 tabular-nums">{{ formatGp(m.value) }}</td>
                </tr>
                <tr v-for="a in m.accounts" :key="a.rsn" class="text-xs text-slate-400">
                  <td class="py-0.5 pl-4">
                    {{ a.rsn }}
                    <span
                      v-if="a.alt"
                      class="ml-1 rounded bg-slate-800 px-1 text-[10px] text-slate-300 uppercase"
                      >alt</span
                    >
                  </td>
                  <td class="text-right tabular-nums">{{ a.count }}</td>
                  <td class="text-right tabular-nums">{{ formatGp(a.value) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </article>
      </div>
    </div>
  </div>
</template>
