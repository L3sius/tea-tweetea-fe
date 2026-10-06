<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { cardLabel, itemName, teamStatusText } from '@/domain/describe'
import type { Card } from '@/domain/game'
import { ITEM_GROUP, ITEM_GROUPS, type ItemGroup } from '@/domain/items'
import { ITEMS, SUITS, type Item, type Suit } from '@/domain/vocabulary'
import { useDevStore } from '@/stores/dev'
import { useGameStore } from '@/stores/game'
import { useTeamStore } from '@/stores/team'
import { teamColor } from '@/ui/colors'

const dev = useDevStore()
const game = useGameStore()
const my = useTeamStore()

const open = ref(false)
const item = ref<Item>('owls_feather')
const rank = ref(7)
const suit = ref<Suit | 'joker'>('diamonds')

const teams = computed(() => [...(game.state?.teams.values() ?? [])])
const team = computed(() =>
  dev.teamId === null ? null : (game.state?.teams.get(dev.teamId) ?? null),
)

// Default to the team this browser manages.
watch(
  () => my.teamId,
  (id) => {
    if (id !== null) dev.teamId = id
  },
  { immediate: true },
)

const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
const RANK_LABEL: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }
const SUIT_SYMBOL: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }

const card = computed<Card>(() =>
  suit.value === 'joker'
    ? { kind: 'joker' }
    : { kind: 'suited', rank: rank.value, suit: suit.value },
)

const itemsByGroup = computed(() => {
  const groups = new Map<ItemGroup, Item[]>()
  for (const i of ITEMS) groups.set(ITEM_GROUP[i], [...(groups.get(ITEM_GROUP[i]) ?? []), i])
  return [...groups].map(([group, items]) => ({ label: ITEM_GROUPS[group].label, items }))
})

const statusLine = computed(() => {
  const t = team.value
  if (!t) return ''
  const now = new Date(game.serverNow())
  return `${teamStatusText(t, now, game.names)} · tile #${t.position} · ${t.gold}g · ${[
    ...t.items.values(),
  ].reduce((a, b) => a + b, 0)}/10 items`
})

const last = computed(() => {
  void game.log
  return dev.lastEntry()
})

async function playAs(name: string) {
  await my.login(name.toLowerCase())
}
</script>

<template>
  <div class="pointer-events-auto flex flex-col items-end gap-2">
    <button
      type="button"
      class="rounded-lg border px-2.5 py-1.5 text-xs font-bold shadow-lg"
      :class="
        open
          ? 'border-fuchsia-400 bg-fuchsia-600 text-white'
          : 'border-fuchsia-500/60 bg-slate-950/90 text-fuchsia-300 hover:bg-slate-900'
      "
      :aria-expanded="open"
      @click="open = !open"
    >
      🛠 Dev{{ dev.riggedCard ? ` · next: ${cardLabel(dev.riggedCard)}` : '' }}
    </button>

    <section
      v-if="open"
      class="flex max-h-[min(70dvh,620px)] w-[min(360px,calc(100vw-1rem))] flex-col gap-3 overflow-y-auto rounded-xl border border-fuchsia-500/40 bg-slate-950/95 p-3 text-xs shadow-2xl backdrop-blur"
      aria-label="Dev tools"
    >
      <header class="flex items-center gap-2">
        <h2 class="font-bold text-fuchsia-300">Play-testing tools</h2>
        <input
          v-model="dev.adminCode"
          type="password"
          placeholder="Admin code"
          aria-label="Admin code"
          class="ml-auto w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1"
        />
      </header>

      <!-- Team -->
      <div>
        <p class="dev-label">Act on</p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="t in teams"
            :key="t.id"
            type="button"
            class="rounded-md border px-2 py-1 font-semibold"
            :style="{
              borderColor: teamColor(t),
              color: dev.teamId === t.id ? '#0f172a' : teamColor(t),
              background: dev.teamId === t.id ? teamColor(t) : 'transparent',
            }"
            @click="dev.teamId = t.id"
          >
            {{ t.name }}
          </button>
        </div>
        <template v-if="team">
          <p class="mt-1.5 text-slate-400">{{ statusLine }}</p>
          <button
            v-if="my.teamId !== team.id"
            type="button"
            class="mt-1 text-sky-300 underline"
            title="Logs in with the team name as the code, as in the sample game"
            @click="playAs(team.name)"
          >
            Play as {{ team.name }}
          </button>
        </template>
      </div>

      <template v-if="team">
        <!-- Turn -->
        <div>
          <p class="dev-label">Turn</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              type="button"
              class="dev-btn !border-fuchsia-500/60"
              :disabled="dev.pending"
              title="From any state: thaw, leave a drawn card or walk, complete the tile"
              @click="dev.makeReady()"
            >
              ⏭ Ready to draw
            </button>
            <button
              type="button"
              class="dev-btn"
              :disabled="dev.pending"
              @click="dev.completeTile()"
            >
              ✓ Complete tile
            </button>
            <button
              type="button"
              class="dev-btn"
              :class="dev.pickingTile ? '!border-orange-400 !text-orange-200' : ''"
              :disabled="dev.pending"
              @click="dev.pickingTile = !dev.pickingTile"
            >
              {{ dev.pickingTile ? 'Click a tile on the map…' : '⤳ Teleport' }}
            </button>
            <button type="button" class="dev-btn" :disabled="dev.pending" @click="dev.freeze(1)">
              ❄ Freeze 1h
            </button>
            <button type="button" class="dev-btn" :disabled="dev.pending" @click="dev.thaw()">
              Thaw
            </button>
          </div>
        </div>

        <!-- Gold -->
        <div>
          <p class="dev-label">Gold</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="delta in [50, 200, -50]"
              :key="delta"
              type="button"
              class="dev-btn"
              :disabled="dev.pending"
              @click="dev.adjustGold(delta)"
            >
              {{ delta > 0 ? '+' : '−' }}{{ Math.abs(delta) }}g
            </button>
          </div>
        </div>

        <!-- Items -->
        <div>
          <p class="dev-label">Give an item</p>
          <div class="flex gap-1.5">
            <select v-model="item" class="dev-input min-w-0 flex-1" aria-label="Item">
              <optgroup v-for="g in itemsByGroup" :key="g.label" :label="g.label">
                <option v-for="i in g.items" :key="i" :value="i">{{ itemName(i) }}</option>
              </optgroup>
            </select>
            <button
              type="button"
              class="dev-btn"
              :disabled="dev.pending"
              @click="dev.giveItem(item)"
            >
              Give
            </button>
          </div>
        </div>

        <!-- Cards -->
        <div>
          <p class="dev-label">Card</p>
          <div class="flex gap-1.5">
            <select
              v-model.number="rank"
              class="dev-input"
              aria-label="Rank"
              :disabled="suit === 'joker'"
            >
              <option v-for="r in RANKS" :key="r" :value="r">{{ RANK_LABEL[r] ?? r }}</option>
            </select>
            <select v-model="suit" class="dev-input" aria-label="Suit">
              <option v-for="s in SUITS" :key="s" :value="s">{{ SUIT_SYMBOL[s] }} {{ s }}</option>
              <option value="joker">🃏 Joker</option>
            </select>
          </div>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              class="dev-btn"
              :disabled="dev.pending"
              title="The team must be ready to draw"
              @click="dev.drawCard(card)"
            >
              Draw {{ cardLabel(card) }} now
            </button>
            <button
              type="button"
              class="dev-btn"
              title="Your next pick in the Draw step deals this card, with the full animation"
              @click="dev.riggedCard = card"
            >
              Rig my next pick
            </button>
            <button
              v-if="dev.riggedCard"
              type="button"
              class="dev-btn"
              @click="dev.riggedCard = null"
            >
              ✕ Unrig {{ cardLabel(dev.riggedCard) }}
            </button>
          </div>
        </div>
      </template>

      <!-- Undo -->
      <div class="border-t border-slate-800 pt-2">
        <button
          type="button"
          class="dev-btn w-full text-left"
          :disabled="dev.pending || !last"
          @click="dev.undo()"
        >
          ↶ Undo
          <span v-if="last" class="text-slate-400">#{{ last.seq }}: {{ last.text }}</span>
        </button>
        <p class="mt-1 text-[11px] text-slate-500">
          Undo removes the newest journal entry and replays the rest. To start over, restart the
          backend: it copies the sample game again.
        </p>
      </div>

      <p
        v-if="dev.message"
        role="status"
        :class="dev.message.tone === 'ok' ? 'text-emerald-300' : 'text-red-300'"
      >
        {{ dev.message.text }}
      </p>
    </section>
  </div>
</template>

<style scoped>
@reference '../assets/main.css';

.dev-label {
  @apply mb-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase;
}
.dev-btn {
  @apply rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200 hover:border-fuchsia-500/60 hover:bg-slate-800 disabled:opacity-50;
}
.dev-input {
  @apply rounded border border-slate-700 bg-slate-900 px-2 py-1;
}
</style>
