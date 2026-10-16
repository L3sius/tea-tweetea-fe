<script setup lang="ts">
import { computed, ref } from 'vue'
import { accountRows, normRsn, type AccountHealth, type AccountRow } from '@/domain/admin'
import type { AdminCommand } from '@/domain/commands'
import type { GameState, Team } from '@/domain/game'
import type { TeamId } from '@/domain/ids'
import type { DinkAccount } from '@/domain/server'
import { useAdminStore } from '@/stores/admin'
import { teamColor } from '@/ui/colors'
import { timeFrom } from '@/ui/format'
import { TtButton, TtPanel, TtText } from '@/ui/tt'

const props = defineProps<{ state: GameState; accounts: DinkAccount[]; now: Date }>()

const admin = useAdminStore()

const HEALTH: Record<AccountHealth, { label: string; color: string; hint: string }> = {
  unknown: {
    label: 'Not on a roster',
    color: 'var(--osrs-red)',
    hint: 'Dink posts for this name, but no team has it: a typo, a name change, or someone not signed up. Its drops count for nobody.',
  },
  silent: {
    label: 'Never heard',
    color: 'var(--osrs-orange)',
    hint: 'On a roster, but Dink has never posted for it. Their plugin may be off, or point somewhere else.',
  },
  quiet: {
    label: 'Quiet',
    color: 'var(--osrs-yellow)',
    hint: 'Nothing from Dink for over six hours. Fine if they are offline.',
  },
  ok: {
    label: 'Reporting',
    color: 'var(--osrs-green)',
    hint: 'Dink posted in the last six hours.',
  },
}

const rows = computed(() => accountRows(props.state.teams.values(), props.accounts, props.now))
const counts = computed(() => {
  const c: Record<AccountHealth, number> = { unknown: 0, silent: 0, quiet: 0, ok: 0 }
  for (const r of rows.value) c[r.health]++
  return c
})
const problemsOnly = ref(true)
const shown = (r: AccountRow) => !problemsOnly.value || r.health !== 'ok'

const unknown = computed(() => rows.value.filter((r) => r.health === 'unknown'))

/**
 * Each team's accounts, member by member: the main account (the member's name) and then their
 * alts. Teams with nothing to show are left out.
 */
const byTeam = computed(() => {
  const health = new Map(rows.value.map((r) => [`${r.teamId}:${normRsn(r.rsn)}`, r]))
  return [...props.state.teams.values()]
    .map((team) => ({
      team,
      lines: team.members.flatMap((m) =>
        m.accounts
          .map((rsn) => ({
            rsn,
            member: m.name,
            alt: normRsn(rsn) !== normRsn(m.name),
            row: health.get(`${team.id}:${normRsn(rsn)}`),
          }))
          .sort((a, b) => Number(a.alt) - Number(b.alt))
          .filter((l) => !l.row || shown(l.row)),
      ),
    }))
    .filter((t) => t.lines.length > 0)
})
const hiddenTeams = computed(() => props.state.teams.size - byTeam.value.length)

const lastSeen = (r: AccountRow | undefined) =>
  r?.lastSeen ? timeFrom(r.lastSeen, props.now) : 'never'

// --- Putting an unknown account on a roster ---

type Target = { key: string; label: string; command: (rsn: string) => AdminCommand }

/** Where an unknown account can go: a new member of a team, or an alt of a member. */
const targets = computed(() =>
  [...props.state.teams.values()].map((t: Team) => ({
    team: t,
    options: [
      {
        key: `new:${t.id}`,
        label: `New member of ${t.name}`,
        command: (rsn: string): AdminCommand => ({ kind: 'add_member', teamId: t.id, name: rsn }),
      },
      ...t.members.map((m): Target => ({
        key: `alt:${t.id}:${m.name}`,
        label: `Alt of ${m.name}`,
        command: (rsn) => ({ kind: 'add_account', teamId: t.id, member: m.name, rsn }),
      })),
    ],
  })),
)
const placing = ref<{ rsn: string; key: string } | null>(null)

async function place() {
  const p = placing.value
  const target = targets.value.flatMap((t) => t.options).find((o) => o.key === p?.key)
  if (!p || !target) return
  if (await admin.run(target.command(p.rsn), `${p.rsn} is on a roster now.`)) placing.value = null
}

const colorOf = (id: TeamId) => {
  const t = props.state.teams.get(id)
  return t ? teamColor(t) : undefined
}
</script>

<template>
  <TtPanel title="Dink accounts" :padding="12" :gap="12">
    <!-- Summary: each number explains itself on hover -->
    <div class="flex w-full flex-wrap items-center gap-x-4 gap-y-2">
      <span
        v-for="h in ['unknown', 'silent', 'quiet', 'ok'] as const"
        :key="h"
        class="tt-1 inline-flex items-center gap-1.5"
        :title="HEALTH[h].hint"
      >
        <span class="dot" :style="{ background: HEALTH[h].color }" />
        <span :style="{ color: HEALTH[h].color }">{{ counts[h] }}</span>
        <span style="color: var(--osrs-white)">{{ HEALTH[h].label.toLowerCase() }}</span>
      </span>
      <TtButton size="sm" class="ml-auto" @click="problemsOnly = !problemsOnly">
        {{ problemsOnly ? 'Show all' : 'Problems only' }}
      </TtButton>
    </div>

    <!-- Accounts whose drops count for nobody: the one thing to fix first -->
    <section v-if="unknown.length" class="section">
      <TtText as="h3" :size="1" color="red" align="left">
        Not on any roster: their drops count for nobody
      </TtText>
      <table class="tt-1 accounts">
        <colgroup>
          <col />
          <col class="w-28" />
          <col class="w-16" />
          <col class="w-[45%]" />
        </colgroup>
        <thead>
          <tr>
            <th>Account</th>
            <th class="num">Last post</th>
            <th class="num">Posts</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in unknown" :key="r.rsn">
            <td class="[overflow-wrap:anywhere]">{{ r.rsn }}</td>
            <td class="num" :title="r.lastSeen?.toLocaleString()">{{ lastSeen(r) }}</td>
            <td class="num">{{ r.posts }}</td>
            <td>
              <div v-if="placing?.rsn === r.rsn" class="flex items-center gap-2">
                <select
                  v-model="placing.key"
                  class="tt-input min-w-0 flex-1"
                  :aria-label="`Where ${r.rsn} goes`"
                >
                  <option value="" disabled>Put on a roster…</option>
                  <optgroup v-for="t in targets" :key="t.team.id" :label="t.team.name">
                    <option v-for="o in t.options" :key="o.key" :value="o.key">
                      {{ o.label }}
                    </option>
                  </optgroup>
                </select>
                <TtButton size="sm" :disabled="admin.pending || !placing.key" @click="place"
                  >Add</TtButton
                >
                <button type="button" class="tt-link tt-1" @click="placing = null">Cancel</button>
              </div>
              <button
                v-else
                type="button"
                class="tt-link tt-1"
                @click="placing = { rsn: r.rsn, key: '' }"
              >
                put on a roster
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Each team's accounts, mains first with their alts under them -->
    <section v-for="{ team, lines } in byTeam" :key="team.id" class="section">
      <TtText as="h3" :size="1" :color="colorOf(team.id)" align="left">{{ team.name }}</TtText>
      <table class="tt-1 accounts">
        <colgroup>
          <col />
          <col class="w-36" />
          <col class="w-28" />
          <col class="w-16" />
        </colgroup>
        <thead>
          <tr>
            <th>Account</th>
            <th>Status</th>
            <th class="num">Last post</th>
            <th class="num">Posts</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in lines" :key="l.rsn">
            <td class="[overflow-wrap:anywhere]">
              <span v-if="l.alt" :title="`An alt of ${l.member}`">
                <span style="color: var(--text-muted)">↳ </span>{{ l.rsn }}
                <span style="color: var(--text-muted)">(alt of {{ l.member }})</span>
              </span>
              <span v-else style="color: var(--osrs-orange)">{{ l.rsn }}</span>
            </td>
            <td>
              <span
                v-if="l.row"
                class="inline-flex items-center gap-1.5"
                :title="HEALTH[l.row.health].hint"
              >
                <span class="dot" :style="{ background: HEALTH[l.row.health].color }" />
                <span :style="{ color: HEALTH[l.row.health].color }">{{
                  HEALTH[l.row.health].label
                }}</span>
              </span>
            </td>
            <td class="num" :title="l.row?.lastSeen?.toLocaleString()">{{ lastSeen(l.row) }}</td>
            <td class="num">{{ l.row?.posts ?? 0 }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <TtText v-if="problemsOnly && hiddenTeams > 0" :size="1" color="green" align="left">
      {{
        byTeam.length === 0
          ? 'Every team is reporting.'
          : `${hiddenTeams} other ${hiddenTeams === 1 ? 'team is' : 'teams are'} reporting fine.`
      }}
    </TtText>
  </TtPanel>
</template>

<style scoped>
.section {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 4px;
}
.accounts {
  width: 100%;
  table-layout: fixed;
  text-align: left;
}
.accounts th,
.accounts td {
  padding: 3px 6px;
  text-align: left;
  vertical-align: top;
}
.accounts th {
  color: var(--osrs-orange);
  font-weight: normal;
}
.accounts td {
  color: var(--osrs-white);
}
.accounts tbody tr:nth-child(odd) td {
  background: rgb(0 0 0 / 0.12);
}
.accounts .num {
  text-align: right;
}
.dot {
  display: inline-block;
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border: 1px solid #000;
}
</style>
