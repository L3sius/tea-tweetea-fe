<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import AdminNotice from '@/components/admin/AdminNotice.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ItemSlot from '@/components/ItemSlot.vue'
import { accountRows, normRsn, type AccountRow } from '@/domain/admin'
import type { AdminCommand } from '@/domain/commands'
import { challengeProgress, effortText, itemName, teamStatusText } from '@/domain/describe'
import type { Member, Team } from '@/domain/game'
import { ITEM_GROUP, ITEM_GROUPS, itemEntry, type ItemGroup } from '@/domain/items'
import { ITEMS, type Item, type Phase } from '@/domain/vocabulary'
import { useAdminStore } from '@/stores/admin'
import { useGameStore } from '@/stores/game'
import { teamColor } from '@/ui/colors'
import { timeFrom } from '@/ui/format'
import { TtButton, TtGemTracker, TtPanel, TtProgressBar, TtText, TtTooltip } from '@/ui/tt'

const props = defineProps<{ team: Team; phase: Phase; now: Date }>()

const admin = useAdminStore()
const game = useGameStore()
const color = computed(() => teamColor(props.team))
const id = computed(() => props.team.id)
const fromOverview = computed(() => admin.overview?.teams.get(id.value) ?? null)
const playing = computed(() => props.phase === 'running' && !props.team.withdrawn)

// Forms belong to one team; switching teams starts them afresh.
watch(id, () => {
  renaming.value = null
  renamingMember.value = null
  addingAccount.value = null
  crediting.value = false
  filter.value = ''
})

/** A destructive command waiting for a yes. */
const asking = shallowRef<{
  title: string
  question: string
  note?: string
  command: AdminCommand
  done: string
} | null>(null)

function ask(title: string, question: string, command: AdminCommand, done: string, note?: string) {
  asking.value = { title, question, note, command, done }
}

async function confirmed() {
  const a = asking.value
  asking.value = null
  if (a) await admin.run(a.command, a.done)
}

const send = (command: AdminCommand, done: string) => admin.run(command, done)

// --- Name ---

const renaming = ref<string | null>(null)
async function rename() {
  const name = renaming.value?.trim()
  if (!name) return
  if (await send({ kind: 'rename_team', teamId: id.value, name }, `Renamed to ${name}.`))
    renaming.value = null
}

// --- Current task ---

const task = computed(() => {
  const { status } = props.team
  if (status.kind !== 'working') return null
  const instance = game.state?.instances.get(status.instanceId)
  const challenge = instance && game.challenges.get(instance.challengeId)
  if (!instance || !challenge) return null
  const standing = instance.progress.get(id.value)
  return {
    instance,
    challenge,
    effort: effortText(challenge, instance, standing, props.now),
    keys: [...(standing?.counts.keys() ?? [])],
    ...challengeProgress(challenge, instance, id.value),
  }
})

/** Completing the tile by hand: the member who gets the credit, picked from the roster. */
const completing = ref<{ member: string } | null>(null)
function startCompleting() {
  // A one-member team has nobody else to credit.
  const [first, ...rest] = props.team.members
  completing.value = { member: first && rest.length === 0 ? first.name : '' }
}
async function completeTile() {
  const member = completing.value?.member
  if (!member) return
  completing.value = null
  await send(
    { kind: 'complete_tile', teamId: id.value, member },
    `Tile completed, credited to ${member}.`,
  )
}
// The task the dialog asks about is gone (Dink completed it, or another team was picked).
watch(
  () => task.value?.instance.id,
  () => (completing.value = null),
)

const crediting = ref(false)
const credit = ref({ key: '', amount: 1 })
async function contribute() {
  const t = task.value
  const key = credit.value.key.trim()
  if (!t || !key || credit.value.amount < 1) return
  const command: AdminCommand = {
    kind: 'contribute',
    teamId: id.value,
    instanceId: t.instance.id,
    key,
    amount: credit.value.amount,
  }
  if (await send(command, `Credited ${credit.value.amount} × ${key}.`)) {
    credit.value = { key: '', amount: 1 }
    crediting.value = false
  }
}

// --- Gold and items ---

const goldDelta = ref<number | null>(null)
async function adjustGold() {
  const delta = goldDelta.value
  if (!delta) return
  const done = delta > 0 ? `Gave ${delta} gold.` : `Took ${-delta} gold.`
  if (await send({ kind: 'adjust_gold', teamId: id.value, delta }, done)) goldDelta.value = null
}

const inventory = computed(() =>
  [...(fromOverview.value?.items ?? [])]
    .filter(([, n]) => n > 0)
    .map(([item, count]) => ({
      item,
      count,
      name: itemName(item),
      text: itemEntry(item).description,
    })),
)
const itemsByGroup = computed(() => {
  const groups = new Map<ItemGroup, Item[]>()
  for (const i of ITEMS) groups.set(ITEM_GROUP[i], [...(groups.get(ITEM_GROUP[i]) ?? []), i])
  return [...groups].map(([group, items]) => ({ label: ITEM_GROUPS[group].label, items }))
})
const giving = ref<Item>(ITEMS[0])
const giveItem = () =>
  send(
    { kind: 'give_item', teamId: id.value, item: giving.value },
    `Gave ${itemName(giving.value)}.`,
  )

// --- Roster ---

const filter = ref('')
/** A search box only once the roster is too long to scan. */
const FILTER_FROM = 8
const accountCount = computed(() => props.team.members.reduce((n, m) => n + m.accounts.length, 0))
const members = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return props.team.members
  return props.team.members.filter(
    (m) => m.name.toLowerCase().includes(q) || m.accounts.some((a) => a.toLowerCase().includes(q)),
  )
})
/** Each account's Dink health, for the dot beside it. */
const health = computed(() => {
  const rows = accountRows([props.team], admin.overview?.accounts ?? [], props.now)
  return new Map(rows.map((r) => [normRsn(r.rsn), r]))
})
const DOT: Record<AccountRow['health'], string> = {
  unknown: 'var(--osrs-red)',
  silent: 'var(--osrs-orange)',
  quiet: 'var(--osrs-yellow)',
  ok: 'var(--osrs-green)',
}
/** A member's name is their main account; every other account of theirs is an alt. */
const altsOf = (m: Member) => m.accounts.filter((a) => normRsn(a) !== normRsn(m.name))
const dotOf = (rsn: string) => DOT[health.value.get(normRsn(rsn))?.health ?? 'silent']
function healthHint(rsn: string): string {
  const r = health.value.get(normRsn(rsn))
  if (!r?.lastSeen) return 'Dink has never posted for this account.'
  return `Last Dink post ${timeFrom(r.lastSeen, props.now)} · ${r.posts} in all`
}

const newMember = ref('')
async function addMember() {
  const name = newMember.value.trim()
  if (!name) return
  if (await send({ kind: 'add_member', teamId: id.value, name }, `${name} joined.`))
    newMember.value = ''
}

const addingAccount = ref<{ member: string; rsn: string } | null>(null)
async function addAccount() {
  const a = addingAccount.value
  const rsn = a?.rsn.trim()
  if (!a || !rsn) return
  const done = `${rsn} now counts for ${a.member}.`
  if (await send({ kind: 'add_account', teamId: id.value, member: a.member, rsn }, done))
    addingAccount.value = null
}

const renamingMember = ref<{ member: string; name: string } | null>(null)
async function renameMember() {
  const r = renamingMember.value
  const name = r?.name.trim()
  if (!r || !name) return
  const command: AdminCommand = { kind: 'rename_member', teamId: id.value, member: r.member, name }
  if (await send(command, `${r.member} is now ${name}.`)) renamingMember.value = null
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-3">
    <!-- The team as a whole: who, how far, and the actions on the team itself -->
    <TtPanel :padding="12" :gap="12">
      <div class="flex w-full flex-wrap items-center justify-between gap-3 text-left">
        <div class="flex min-w-0 flex-col gap-1.5">
          <TtText
            as="h2"
            :size="2"
            font="bold"
            :color="color"
            align="left"
            class="[overflow-wrap:anywhere]"
            >{{ team.name }}</TtText
          >
          <TtGemTracker :held="team.gems" :scale="1" :slots="false" />
          <span class="tt-1 flex flex-wrap gap-x-3" style="color: var(--text-muted)">
            <span>{{ team.tilesCompleted }} tiles completed · Tile #{{ team.position }}</span>
            <span v-if="team.withdrawn" style="color: var(--osrs-red)">Withdrawn</span>
          </span>
        </div>
        <div v-if="renaming !== null" class="flex flex-wrap items-start gap-3">
          <input
            v-model="renaming"
            class="tt-input tt-field w-56 max-w-full"
            aria-label="New team name"
            @keydown.enter="rename"
            @keydown.escape="renaming = null"
          />
          <TtButton
            size="sm"
            :width="128"
            :disabled="admin.pending || !renaming.trim()"
            @click="rename"
            >Save</TtButton
          >
          <TtButton size="sm" :width="128" @click="renaming = null">Cancel</TtButton>
        </div>
        <div v-else class="flex flex-wrap items-start gap-3">
          <TtButton size="sm" :width="128" @click="renaming = team.name">Rename</TtButton>
          <TtButton
            size="sm"
            :width="128"
            :disabled="admin.pending"
            @click="
              ask(
                'New code',
                `Make a new code for ${team.name}?`,
                { kind: 'reset_team_code', teamId: id },
                'New code made.',
                'The old code stops working at once. Give the captain the new one.',
              )
            "
            >New code</TtButton
          >
          <TtButton
            v-if="phase === 'running'"
            size="sm"
            :width="128"
            :disabled="admin.pending"
            @click="
              team.withdrawn
                ? send({ kind: 'set_withdrawn', teamId: id, withdrawn: false }, 'Back in the game.')
                : ask(
                    'Withdraw team',
                    `Take ${team.name} out of the game?`,
                    { kind: 'set_withdrawn', teamId: id, withdrawn: true },
                    'Withdrawn.',
                    'It cannot act, be targeted or score, and ranks last. You can bring it back.',
                  )
            "
            >{{ team.withdrawn ? 'Reinstate' : 'Withdraw' }}</TtButton
          >
          <TtButton
            v-if="phase === 'setup'"
            size="sm"
            :width="128"
            :disabled="admin.pending"
            @click="
              ask(
                'Delete team',
                `Delete ${team.name} and its roster?`,
                { kind: 'delete_team', teamId: id },
                'Deleted.',
                'The teams after it move down one place.',
              )
            "
            >Delete</TtButton
          >
        </div>
      </div>
      <AdminNotice v-if="fromOverview?.codeIssued === false" tone="warn" class="w-full">
        This team's code was picked by hand and may be easy to guess. Make a new one.
      </AdminNotice>
    </TtPanel>

    <div
      class="grid items-stretch gap-3"
      :class="{ 'xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]': phase === 'running' }"
    >
      <!-- Current task: completing it by hand is the most common fix -->
      <TtPanel v-if="phase === 'running'" top :padding="12" :gap="12">
        <section class="admin-section">
          <TtText as="h3" :size="1" font="bold" color="orange" align="left">Current task</TtText>
          <template v-if="task && playing">
            <div class="flex flex-col gap-1.5">
              <TtText :size="2" color="white" align="left">{{ task.challenge.name }}</TtText>
              <TtText v-if="task.challenge.description" :size="1" color="muted" align="left">
                {{ task.challenge.description }}
              </TtText>
            </div>
            <div class="flex flex-col gap-1.5">
              <TtProgressBar
                :value="task.done"
                :max="task.needed"
                :color="color"
                :label="`${task.done} / ${task.needed}`"
                :height="30"
              />
              <TtText v-if="task.effort" :size="1" color="muted" align="left">{{
                task.effort
              }}</TtText>
            </div>
            <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
              <TtButton
                v-if="team.members.length"
                :disabled="admin.pending"
                @click="startCompleting"
                >Complete tile</TtButton
              >
              <TtText v-else :size="1" color="orange" align="left"
                >Add a member to the roster to complete the tile: one of them gets the
                credit.</TtText
              >
              <button
                type="button"
                class="tt-link tt-1"
                :aria-expanded="crediting"
                @click="crediting = !crediting"
              >
                {{ crediting ? 'Cancel crediting' : 'Credit some progress instead →' }}
              </button>
            </div>
            <div v-if="crediting" class="flex flex-wrap items-start gap-3">
              <input
                v-model="credit.key"
                :list="`keys-${id}`"
                class="tt-input tt-field min-w-40 flex-1"
                placeholder="Item, boss or task"
                aria-label="What to credit"
                @keydown.enter="contribute"
              />
              <datalist :id="`keys-${id}`">
                <option v-for="k in task.keys" :key="k" :value="k" />
              </datalist>
              <input
                v-model.number="credit.amount"
                type="number"
                min="1"
                class="tt-input tt-field w-24"
                aria-label="How many"
                @keydown.enter="contribute"
              />
              <TtButton
                size="sm"
                :width="128"
                :disabled="admin.pending || !credit.key.trim() || credit.amount < 1"
                @click="contribute"
                >Credit</TtButton
              >
            </div>
          </template>
          <TtText v-else :size="1" color="white" align="left">
            No tile task open: {{ teamStatusText(team, now).toLowerCase() }}. A tile can be
            completed while the team works on one.
          </TtText>
        </section>
      </TtPanel>

      <!-- Gold and items -->
      <TtPanel top :padding="12" :gap="12">
        <section class="admin-section">
          <TtText as="h3" :size="1" font="bold" color="orange" align="left"
            >Gold &amp; items</TtText
          >
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div class="flex flex-col gap-1.5">
              <span class="tt-1" style="color: var(--text-muted)">Team balance</span>
              <span class="flex items-center gap-1.5">
                <span class="tt-sprite tt-icon-coins size-6" aria-hidden="true" />
                <TtText :size="2" color="yellow">{{ team.gold }}</TtText>
                <span class="tt-1" style="color: var(--text-muted)">gp</span>
              </span>
            </div>
            <div v-if="playing" class="flex items-start gap-3">
              <input
                v-model.number="goldDelta"
                type="number"
                class="tt-input tt-field w-28"
                placeholder="± gold"
                aria-label="Gold to give, or take with a minus"
                @keydown.enter="adjustGold"
              />
              <TtButton
                size="sm"
                :width="128"
                :disabled="admin.pending || !goldDelta"
                @click="adjustGold"
                >Apply</TtButton
              >
            </div>
          </div>
          <div class="admin-divider" />
          <TtText v-if="fromOverview && inventory.length === 0" :size="1" color="muted" align="left"
            >No items held.</TtText
          >
          <!-- Pictures with hover info; a click asks to discard one -->
          <ul v-if="inventory.length" class="flex flex-wrap gap-1.5" aria-label="Items">
            <TtTooltip v-for="i in inventory" :key="i.item" as="li" class="outline-none">
              <button
                type="button"
                class="block"
                :aria-label="`Discard one ${i.name}`"
                @click="
                  ask(
                    'Discard item',
                    `Take one ${i.name} from ${team.name}?`,
                    { kind: 'discard_item', teamId: id, item: i.item },
                    'Discarded.',
                  )
                "
              >
                <ItemSlot :item="i.item" :count="i.count" :size="56" hint="" />
              </button>
              <template #tip>
                <span class="block" style="color: var(--osrs-orange)">{{ i.name }}</span>
                {{ i.text }}
                <span class="mt-1 block" style="color: var(--text-muted)"
                  >Click to discard one.</span
                >
              </template>
            </TtTooltip>
          </ul>
          <div v-if="playing" class="flex flex-wrap items-start gap-3">
            <select
              v-model="giving"
              class="tt-input tt-field min-w-40 flex-1"
              aria-label="Item to give"
            >
              <optgroup v-for="g in itemsByGroup" :key="g.label" :label="g.label">
                <option v-for="i in g.items" :key="i" :value="i">{{ itemName(i) }}</option>
              </optgroup>
            </select>
            <TtButton size="sm" :width="128" :disabled="admin.pending" @click="giveItem"
              >Give item</TtButton
            >
          </div>
        </section>
      </TtPanel>
    </div>

    <!-- Roster: one row per member, accounts on the row, actions on hover -->
    <TtPanel :padding="12" :gap="12">
      <section class="admin-section">
        <div class="flex flex-wrap items-center gap-3">
          <TtText as="h3" :size="1" font="bold" color="orange" align="left">Team roster</TtText>
          <span class="tt-1" style="color: var(--text-muted)"
            >{{ team.members.length }} members · {{ accountCount }} accounts</span
          >
          <input
            v-if="team.members.length >= FILTER_FROM"
            v-model="filter"
            type="search"
            class="tt-input ml-auto w-44"
            placeholder="Find a name"
            aria-label="Find a member or account"
          />
        </div>
        <div class="overflow-x-auto">
          <table class="tt-1 roster w-full">
            <thead>
              <tr>
                <th>Main account</th>
                <th>Alts</th>
                <th><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="m in members" :key="m.name">
                <tr>
                  <td>
                    <input
                      v-if="renamingMember?.member === m.name"
                      v-model="renamingMember.name"
                      class="tt-input w-full"
                      aria-label="New name for the main account"
                      @keydown.enter="renameMember"
                      @keydown.escape="renamingMember = null"
                    />
                    <span
                      v-else
                      class="inline-flex items-center gap-1.5"
                      :title="healthHint(m.name)"
                    >
                      <span class="dot" :style="{ background: dotOf(m.name) }" />
                      <span class="[overflow-wrap:anywhere]" style="color: var(--osrs-orange)">{{
                        m.name
                      }}</span>
                    </span>
                  </td>
                  <td>
                    <span v-if="altsOf(m).length" class="flex flex-wrap gap-x-3 gap-y-0.5">
                      <span
                        v-for="rsn in altsOf(m)"
                        :key="rsn"
                        class="inline-flex items-center gap-1.5"
                        :title="healthHint(rsn)"
                      >
                        <span class="dot" :style="{ background: dotOf(rsn) }" />
                        <span class="[overflow-wrap:anywhere]">{{ rsn }}</span>
                        <button
                          type="button"
                          class="tt-link tt-1 on-hover"
                          :aria-label="`Remove alt ${rsn}`"
                          @click="
                            ask(
                              'Remove alt',
                              `Stop counting ${rsn} for ${m.name}?`,
                              { kind: 'remove_account', teamId: id, member: m.name, rsn },
                              `${rsn} no longer counts.`,
                            )
                          "
                        >
                          ×
                        </button>
                      </span>
                    </span>
                    <span v-else style="color: var(--text-muted)">—</span>
                  </td>
                  <td class="text-right whitespace-nowrap">
                    <span v-if="renamingMember?.member === m.name" class="row-actions">
                      <button type="button" class="tt-link tt-1" @click="renameMember">save</button>
                      <button type="button" class="tt-link tt-1" @click="renamingMember = null">
                        cancel
                      </button>
                    </span>
                    <span v-else class="row-actions on-hover">
                      <button
                        type="button"
                        class="tt-link tt-1"
                        @click="addingAccount = { member: m.name, rsn: '' }"
                      >
                        + alt
                      </button>
                      <button
                        type="button"
                        class="tt-link tt-1"
                        @click="renamingMember = { member: m.name, name: m.name }"
                      >
                        rename
                      </button>
                      <button
                        type="button"
                        class="tt-link tt-1"
                        @click="
                          ask(
                            'Remove member',
                            altsOf(m).length
                              ? `Remove ${m.name} and their ${altsOf(m).length === 1 ? 'alt' : `${altsOf(m).length} alts`} from ${team.name}?`
                              : `Remove ${m.name} from ${team.name}?`,
                            { kind: 'remove_member', teamId: id, member: m.name },
                            `${m.name} left.`,
                            'Progress they brought in stays with the team.',
                          )
                        "
                      >
                        remove
                      </button>
                    </span>
                  </td>
                </tr>
                <tr v-if="addingAccount?.member === m.name" class="adding">
                  <td colspan="3">
                    <div class="flex flex-wrap items-start gap-3">
                      <input
                        v-model="addingAccount.rsn"
                        class="tt-input tt-field min-w-40 flex-1"
                        :placeholder="`An alt of ${m.name}`"
                        aria-label="Alt to add"
                        @keydown.enter="addAccount"
                        @keydown.escape="addingAccount = null"
                      />
                      <TtButton
                        size="sm"
                        :width="128"
                        :disabled="admin.pending || !addingAccount.rsn.trim()"
                        @click="addAccount"
                        >Add alt</TtButton
                      >
                      <TtButton size="sm" :width="128" @click="addingAccount = null"
                        >Cancel</TtButton
                      >
                    </div>
                  </td>
                </tr>
              </template>
              <tr v-if="members.length === 0">
                <td colspan="3" style="color: var(--text-muted)">
                  {{ filter ? 'No name matches.' : 'No members yet.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex flex-wrap items-start gap-3">
          <input
            v-model="newMember"
            class="tt-input tt-field min-w-40 flex-1"
            placeholder="New member's RuneScape name"
            aria-label="New member"
            @keydown.enter="addMember"
          />
          <TtButton
            size="sm"
            :width="128"
            :disabled="admin.pending || !newMember.trim()"
            @click="addMember"
            >Add member</TtButton
          >
        </div>
      </section>
    </TtPanel>

    <ConfirmDialog
      v-if="completing && task"
      title="Complete tile"
      :question="`Complete ${team.name}'s tile: ${task.challenge.name}?`"
      note="For when Dink missed something. The team can use an item and draw next."
      confirm-label="Complete"
      cancel-label="Cancel"
      :button-width="160"
      :confirm-disabled="admin.pending || !completing.member"
      @confirm="completeTile"
      @cancel="completing = null"
    >
      <template #fields>
        <label class="flex w-full flex-col gap-1.5 text-left">
          <span class="tt-1" style="color: var(--osrs-orange)">Who gets the credit</span>
          <select v-model="completing.member" class="tt-input tt-field w-full">
            <option value="" disabled>Pick a member</option>
            <option v-for="m in team.members" :key="m.name" :value="m.name">{{ m.name }}</option>
          </select>
        </label>
      </template>
    </ConfirmDialog>

    <ConfirmDialog
      v-if="asking"
      :title="asking.title"
      :question="asking.question"
      :note="asking.note"
      @confirm="confirmed"
      @cancel="asking = null"
    />
  </div>
</template>

<style scoped>
/* A panel's content: left-aligned, 12px between its parts. */
.admin-section {
  width: 100%;
  height: 100%;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.admin-divider {
  border-top: 2px solid rgb(0 0 0 / 0.35);
}
.roster th {
  padding: 0 12px 6px;
  color: var(--osrs-orange);
  font-weight: normal;
  text-align: left;
}
/* Every row 48px, so swapping a name for its rename box doesn't move the rows below. */
.roster td {
  height: 48px;
  box-sizing: border-box;
  padding: 6px 12px;
  color: var(--osrs-white);
  vertical-align: middle;
}
.roster td:first-child {
  width: 34%;
}
.roster tbody tr:nth-child(odd) td {
  background: rgb(0 0 0 / 0.12);
}
.roster tr.adding td {
  background: rgb(0 0 0 / 0.24);
}
.row-actions {
  display: inline-flex;
  gap: 12px;
}
.dot {
  display: inline-block;
  flex: none;
  width: 8px;
  height: 8px;
  border: 1px solid #000;
}
/* Row actions show on hover or focus, so 20 members stay readable; touch screens always show them. */
.on-hover {
  visibility: hidden;
}
.roster tr:hover .on-hover,
.roster tr:focus-within .on-hover {
  visibility: visible;
}
@media (hover: none) {
  .on-hover {
    visibility: visible;
  }
}
</style>
