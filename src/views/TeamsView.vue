<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted } from 'vue'
import GemRow from '@/components/GemRow.vue'
import { useGameStore } from '@/stores/game'
import { useStatsStore } from '@/stores/stats'
import { teamColor } from '@/ui/colors'
import { formatGp } from '@/ui/format'
import { TtPanel, TtText, stack } from '@/ui/tt'

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
    <div class="mx-auto flex max-w-[1440px] flex-col gap-1.5">
      <TtPanel variant="iron" :padding="6" :gap="3">
        <TtText as="h2" :size="3" font="quill" color="orange" glow>Teams and rosters</TtText>
        <TtText :size="1" color="white">
          Every account a player's Dink reports come from counts for their team, alts included.
        </TtText>
      </TtPanel>
      <div class="grid gap-1.5 md:grid-cols-2">
        <TtPanel v-for="r in rosters" :key="r.team.id" :padding="12" :gap="9">
          <template #title>
            <span class="[overflow-wrap:anywhere]" :style="{ color: r.color }">{{
              r.team.name
            }}</span>
          </template>
          <GemRow :gems="r.team.gems" />
          <TtText :size="1" color="white">
            {{ r.members.length }} players · {{ r.accounts }} accounts ·
            <span :style="{ color: stack(r.value).color }">{{ formatGp(r.value) }}</span>
          </TtText>
          <table class="tt-1 w-full">
            <thead style="color: var(--osrs-orange)">
              <tr>
                <th class="text-left font-normal">Player / account</th>
                <th class="text-right font-normal">Events</th>
                <th class="text-right font-normal">Loot</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="m in r.members" :key="m.name">
                <tr style="color: var(--osrs-yellow)">
                  <td class="tt-bold pt-1.5 text-left">{{ m.name }}</td>
                  <td class="text-right">{{ m.count }}</td>
                  <td class="text-right" :style="{ color: stack(m.value).color }">
                    {{ formatGp(m.value) }}
                  </td>
                </tr>
                <tr v-for="a in m.accounts" :key="a.rsn" style="color: var(--text-muted)">
                  <td class="pl-4 text-left">
                    {{ a.rsn }}
                    <span v-if="a.alt" style="color: var(--osrs-cyan)">(alt)</span>
                  </td>
                  <td class="text-right">{{ a.count }}</td>
                  <td class="text-right">{{ formatGp(a.value) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </TtPanel>
      </div>
    </div>
  </div>
</template>
