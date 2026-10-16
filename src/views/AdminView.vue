<script setup lang="ts">
import { useIntervalFn, useNow } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AdminAccounts from '@/components/admin/AdminAccounts.vue'
import AdminNotice from '@/components/admin/AdminNotice.vue'
import AdminTeamDetail from '@/components/admin/AdminTeamDetail.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { accountRows } from '@/domain/admin'
import { teamStatusText } from '@/domain/describe'
import type { TeamId } from '@/domain/ids'
import { useAdminStore } from '@/stores/admin'
import { useGameStore } from '@/stores/game'
import { teamColor } from '@/ui/colors'
import { TtButton, TtPanel, TtText } from '@/ui/tt'

const admin = useAdminStore()
const game = useGameStore()
const now = useNow({ scheduler: (tick) => useIntervalFn(tick, 1_000) })

// Nothing links here, and search engines should not list it either. The admin code is what
// protects it: the server checks it on every request.
let robots: HTMLMetaElement | null = null
onMounted(() => {
  robots = document.createElement('meta')
  robots.name = 'robots'
  robots.content = 'noindex, nofollow'
  document.head.append(robots)
  void admin.restore()
})
onUnmounted(() => robots?.remove())

const codeInput = ref('')
async function login() {
  await admin.login(codeInput.value)
  if (admin.loggedIn) codeInput.value = ''
}
const lockSeconds = computed(() => {
  const until = admin.lockedUntil
  return until === null ? 0 : Math.max(0, Math.ceil((until - now.value.getTime()) / 1000))
})

const state = computed(() => game.state)
const phase = computed(() => state.value?.phase ?? 'setup')
const teams = computed(() => [...(state.value?.teams.values() ?? [])])

const tab = ref<'teams' | 'dink'>('teams')
const chosenId = ref<TeamId | null>(null)
/** The team open on the right; the first one until another is picked, or after a delete. */
const chosen = computed(
  () => teams.value.find((t) => t.id === chosenId.value) ?? teams.value[0] ?? null,
)
const dinkProblems = computed(() =>
  state.value
    ? accountRows(state.value.teams.values(), admin.overview?.accounts ?? [], now.value).filter(
        (r) => r.health !== 'ok',
      ).length
    : 0,
)

const newTeam = ref('')
async function createTeam() {
  const name = newTeam.value.trim()
  if (!name) return
  if (await admin.run({ kind: 'create_team', name }, `${name} created.`)) newTeam.value = ''
}

const starting = ref(false)
async function startGame() {
  starting.value = false
  await admin.run({ kind: 'start_game' }, 'The game has started.')
}

const copied = ref(false)
async function copyCode() {
  if (!admin.issued) return
  try {
    await navigator.clipboard.writeText(admin.issued.code)
    copied.value = true
  } catch {
    // No clipboard access: the code is on screen to copy by hand.
  }
}
function closeIssued() {
  admin.issued = null
  copied.value = false
}
</script>

<template>
  <div class="h-full overflow-y-auto">
    <!-- Login -->
    <div v-if="!admin.loggedIn" class="mx-auto flex max-w-[420px] flex-col pt-6">
      <TtPanel title="Game admin" :padding="15" :gap="12">
        <form class="flex flex-col items-center gap-3" @submit.prevent="login">
          <div class="tt-sprite-display box-border flex h-[72px] w-[300px] max-w-full items-center">
            <input
              v-model="codeInput"
              type="password"
              autocomplete="off"
              placeholder="Admin code"
              aria-label="Admin code"
              class="tt-2 w-full border-0 bg-transparent text-center outline-none"
              style="color: var(--osrs-white); caret-color: var(--osrs-yellow)"
            />
          </div>
          <AdminNotice v-if="lockSeconds > 0" tone="error">
            Too many wrong codes. Try again in {{ Math.floor(lockSeconds / 60) }}:{{
              String(lockSeconds % 60).padStart(2, '0')
            }}.
          </AdminNotice>
          <template v-else>
            <AdminNotice v-if="admin.message" :tone="admin.message.tone">{{
              admin.message.text
            }}</AdminNotice>
            <TtButton type="submit" :disabled="admin.pending || !codeInput.trim()">Log in</TtButton>
          </template>
        </form>
      </TtPanel>
    </div>

    <div v-else-if="state" class="mx-auto flex max-w-[1440px] flex-col gap-3">
      <!-- One row instead of a header: the tabs, what the game is doing, and the game-wide actions -->
      <div class="flex flex-wrap items-start gap-3">
        <h2 class="sr-only">Game admin</h2>
        <!-- Tabs: the teams, or Dink's view of the accounts -->
        <div class="flex flex-wrap gap-3" role="tablist">
          <TtButton
            size="sm"
            :width="128"
            role="tab"
            :selected="tab === 'teams'"
            @click="tab = 'teams'"
            >Teams</TtButton
          >
          <TtButton size="sm" role="tab" :selected="tab === 'dink'" @click="tab = 'dink'">
            Dink accounts{{ dinkProblems ? ` (${dinkProblems} to check)` : '' }}
          </TtButton>
        </div>
        <!-- Lined up with the button faces (44px tall), so a message doesn't push the row down -->
        <div class="flex min-h-11 min-w-48 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
          <TtText :size="1" color="white" align="left">
            {{ phase === 'setup' ? 'Setting up' : phase === 'running' ? 'Running' : 'Ended' }}
          </TtText>
          <AdminNotice v-if="admin.message" :tone="admin.message.tone" class="min-w-0">{{
            admin.message.text
          }}</AdminNotice>
        </div>
        <div class="ml-auto flex flex-wrap items-start gap-3">
          <TtButton
            v-if="phase === 'setup' && teams.length > 0"
            size="sm"
            :width="128"
            :disabled="admin.pending"
            @click="starting = true"
            >Start game</TtButton
          >
          <TtButton size="sm" :width="128" @click="admin.logout">Log out</TtButton>
        </div>
      </div>

      <AdminAccounts
        v-if="tab === 'dink'"
        :state="state"
        :accounts="admin.overview?.accounts ?? []"
        :now="now"
      />

      <div v-else class="grid items-start gap-3 md:grid-cols-[288px_minmax(0,1fr)]">
        <!-- Every team as one card; the chosen one opens on the right -->
        <TtPanel class="md:sticky md:top-0" :padding="12" :gap="12">
          <div class="flex w-full flex-col gap-3 text-left">
            <TtText as="h3" :size="1" color="white" align="left">Teams ({{ teams.length }})</TtText>
            <form
              v-if="phase === 'setup'"
              class="flex flex-col items-end gap-1.5"
              @submit.prevent="createTeam"
            >
              <input
                v-model="newTeam"
                class="tt-input tt-field w-full"
                placeholder="New team's name"
                aria-label="New team's name"
              />
              <TtButton
                type="submit"
                size="sm"
                :width="128"
                :disabled="admin.pending || !newTeam.trim()"
                >Create</TtButton
              >
            </form>
            <TtText v-if="teams.length === 0" :size="1" color="muted" align="left"
              >No teams yet.</TtText
            >
            <ul class="flex w-full min-w-0 flex-col gap-1.5">
              <li v-for="t in teams" :key="t.id" class="min-w-0">
                <button
                  type="button"
                  class="team-card"
                  :class="{ chosen: chosen?.id === t.id }"
                  :style="{ '--team': teamColor(t) }"
                  :aria-current="chosen?.id === t.id ? 'true' : undefined"
                  @click="chosenId = t.id"
                >
                  <span class="flex items-center gap-2">
                    <span
                      class="min-w-0 flex-1 truncate"
                      :style="{ color: teamColor(t) }"
                      :title="t.name"
                      >{{ t.name }}</span
                    >
                    <span
                      v-if="admin.overview?.teams.get(t.id)?.codeIssued === false"
                      style="color: var(--osrs-orange)"
                      title="This team's code was picked by hand and may be easy to guess. Open the team and press New code."
                      >weak code</span
                    >
                    <span
                      v-if="t.withdrawn"
                      style="color: var(--osrs-red)"
                      title="Taken out of the game: it cannot act, be targeted or score."
                      >withdrawn</span
                    >
                  </span>
                  <span
                    class="block truncate"
                    style="color: var(--text-muted)"
                    :title="teamStatusText(t, now)"
                    >{{ teamStatusText(t, now) }}</span
                  >
                </button>
              </li>
            </ul>
          </div>
        </TtPanel>
        <AdminTeamDetail v-if="chosen" :team="chosen" :phase="phase" :now="now" />
      </div>
    </div>

    <ConfirmDialog
      v-if="starting"
      title="Start game"
      :question="`Start the game with ${teams.length} teams?`"
      note="Tiles, shops and gems are dealt and every team is placed. This happens once."
      @confirm="startGame"
      @cancel="starting = false"
    />

    <!-- A new code, shown once -->
    <ConfirmDialog
      v-if="admin.issued"
      :title="`${admin.issued.name}'s code`"
      question="Give this code to the team's captain. It is shown only this once."
      note="Anyone with the code can play as the team, so send it privately. The server keeps only a hash of it: if it gets lost, make a new one."
      :confirm-label="copied ? 'Copied' : 'Copy'"
      cancel-label="Done"
      :button-width="160"
      @confirm="copyCode"
      @cancel="closeIssued"
    >
      <div
        class="tt-sprite-display box-border flex min-h-[72px] w-full items-center justify-center"
      >
        <TtText
          :size="2"
          color="yellow"
          class="select-all [overflow-wrap:anywhere]"
          aria-label="New team code"
          >{{ admin.issued.code }}</TtText
        >
      </div>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
/* Every card the same height, two lines: name and badges, then what the team is doing. */
.team-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  box-sizing: border-box;
  width: 100%;
  height: 66px;
  min-width: 0;
  overflow: hidden;
  padding: 6px 12px;
  border: 2px solid transparent;
  border-left: 4px solid var(--team);
  background: rgb(0 0 0 / 0.18);
  text-align: left;
  font-family: var(--font-small);
  font-size: var(--fs-1);
  text-shadow: 1px 1px 0 #000;
  cursor: pointer;
}
.team-card:hover,
.team-card:focus-visible {
  background: rgb(255 255 255 / 0.06);
  outline: none;
}
.team-card:focus-visible {
  border-color: var(--osrs-orange);
  border-left-color: var(--team);
}
.team-card.chosen {
  border-color: var(--stone-ornament-2);
  border-left-color: var(--team);
  background: rgb(255 255 255 / 0.12);
}
</style>
