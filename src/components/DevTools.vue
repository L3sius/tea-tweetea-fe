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
import { TtButton, TtDivider } from '@/ui/tt'

const dev = useDevStore()
const game = useGameStore()
const my = useTeamStore()

const open = ref(false)
const item = ref<Item>('bronze_feather')
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
    <TtButton size="sm" :selected="open" :aria-expanded="open" @click="open = !open">
      <span :style="{ color: 'var(--gem-purple-glow)' }">Dev</span>
      <template v-if="dev.riggedCard">: next {{ cardLabel(dev.riggedCard) }}</template>
    </TtButton>

    <section
      v-if="open"
      class="tt-frame-iron tt-1 flex max-h-[min(70dvh,620px)] w-[min(380px,calc(100vw-1rem))] flex-col gap-3 overflow-y-auto p-1.5"
      style="color: var(--osrs-white)"
      aria-label="Dev tools"
    >
      <header class="flex items-center gap-2">
        <h2 class="tt-bold" style="color: var(--gem-purple-glow)">Play-testing tools</h2>
        <input
          v-model="dev.adminCode"
          type="password"
          placeholder="Admin code"
          aria-label="Admin code"
          class="tt-input ml-auto w-32"
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
            class="dev-btn tt-bold"
            :style="{
              color: dev.teamId === t.id ? '#000' : teamColor(t),
              background: dev.teamId === t.id ? teamColor(t) : undefined,
              textShadow: dev.teamId === t.id ? 'none' : undefined,
            }"
            @click="dev.teamId = t.id"
          >
            {{ t.name }}
          </button>
        </div>
        <template v-if="team">
          <p class="mt-1.5" style="color: var(--text-muted)">{{ statusLine }}</p>
          <button
            v-if="my.teamId !== team.id"
            type="button"
            class="tt-link mt-1"
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
              class="dev-btn"
              style="color: var(--gem-purple-glow)"
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
              :class="{ 'dev-btn-on': dev.pickingTile }"
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
            <select v-model="item" class="tt-input min-w-0 flex-1" aria-label="Item">
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
              class="tt-input"
              aria-label="Rank"
              :disabled="suit === 'joker'"
            >
              <option v-for="r in RANKS" :key="r" :value="r">{{ RANK_LABEL[r] ?? r }}</option>
            </select>
            <select v-model="suit" class="tt-input" aria-label="Suit">
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
      <div class="flex flex-col gap-1">
        <TtDivider variant="iron" />
        <button
          type="button"
          class="dev-btn w-full text-left"
          :disabled="dev.pending || !last"
          @click="dev.undo()"
        >
          ↶ Undo
          <span v-if="last" style="color: var(--osrs-white)">#{{ last.seq }}: {{ last.text }}</span>
        </button>
        <p style="color: var(--text-muted)">
          Undo removes the newest journal entry and replays the rest. To start over, restart the
          backend: it copies the sample game again.
        </p>
      </div>

      <p
        v-if="dev.message"
        role="status"
        :style="{ color: dev.message.tone === 'ok' ? 'var(--osrs-green)' : 'var(--osrs-red)' }"
      >
        {{ dev.message.text }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.dev-label {
  margin-bottom: 3px;
  color: var(--osrs-orange);
}
/* A small flat stone button: the TtButton look at a size that fits many to a row. */
.dev-btn {
  border: 3px solid #000;
  background: var(--button-face);
  box-shadow:
    inset 3px 3px 0 var(--button-hi),
    inset -3px -3px 0 var(--button-lo);
  padding: 3px 9px;
  color: var(--osrs-yellow);
  cursor: pointer;
}
.dev-btn:hover:not(:disabled) {
  color: var(--osrs-white);
  filter: var(--hover-brighten);
}
.dev-btn:disabled {
  cursor: default;
  filter: var(--disabled-filter);
}
.dev-btn-on {
  color: var(--osrs-orange);
  box-shadow:
    inset 3px 3px 0 var(--button-lo),
    inset -3px -3px 0 var(--button-hi);
}
</style>
