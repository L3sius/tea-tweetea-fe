<script setup lang="ts">
import { useIntervalFn, useNow } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { cardLabel, challengeProgress, clock, effectText, itemName } from '@/domain/describe'
import type { GameState } from '@/domain/game'
import { whyNotUsable } from '@/domain/items'
import type { Item } from '@/domain/vocabulary'
import { useGameStore } from '@/stores/game'
import { useTeamStore } from '@/stores/team'
import { GEM_COLORS, teamColor } from '@/ui/colors'
import CardDraw from './CardDraw.vue'
import PlayingCard from './PlayingCard.vue'
import PowerUpPicker from './PowerUpPicker.vue'

const emit = defineEmits<{ openShop: []; locate: [] }>()

const game = useGameStore()
const my = useTeamStore()
const now = useNow({ scheduler: (tick) => useIntervalFn(tick, 1_000) })
const codeInput = ref('')
const cardDraw = useTemplateRef('cardDraw')

const team = computed(() => my.team)
const state = computed(() => game.state as GameState)
const color = computed(() => (team.value ? teamColor(team.value) : '#94a3b8'))

/** The piece is still walking on the map; the new status would spoil where it ends. */
const animating = computed(() => {
  void now.value
  return team.value ? game.choreography.isAnimating(team.value.id, game.serverNow()) : false
})

const frozen = computed(() => {
  const until = team.value?.frozenUntil
  return until && until > now.value ? until : null
})

const pause = computed(() =>
  team.value?.status.kind === 'moving' ? (team.value.status.move.pauses[0] ?? null) : null,
)

/** The team can buy when paused at a shop, or standing on a shop tile. */
const atShop = computed(() => {
  const t = team.value
  if (!t || !game.board) return false
  if (pause.value?.kind === 'shop') return true
  const standing = ['working', 'ready', 'drawn'].includes(t.status.kind)
  return standing && game.board.tiles.get(t.position)?.kind === 'shop'
})

/** A match this team won and must now pick a gem from. */
const stealing = computed(() => {
  const t = team.value
  if (!t) return null
  for (const m of state.value.matches.values()) {
    if (m.outcome.kind === 'stealing' && m.outcome.winner === t.id) return m.outcome
  }
  return null
})

const task = computed(() => {
  const t = team.value
  if (!t || t.status.kind !== 'working') return null
  const instance = state.value.instances.get(t.status.instanceId)
  const challenge = instance && game.challenges.get(instance.challengeId)
  if (!challenge) return null
  return { challenge, ...challengeProgress(challenge, instance, t.id) }
})

const usableCount = computed(() => {
  const t = team.value
  if (!t) return 0
  return [...t.items].filter(([item, n]) => n > 0 && whyNotUsable(t, item, now.value) === null)
    .length
})

/** The item used on this tile, from the log: the latest `item_used` since the team arrived. */
const usedHere = computed(() => {
  const t = team.value
  if (!t?.effects.itemUsedHere) return null
  for (const entry of [...game.log].reverse()) {
    for (const event of [...entry.events].reverse()) {
      if (event.kind === 'item_used' && event.teamId === t.id) return event.item
      if ((event.kind === 'landed' || event.kind === 'teleported') && event.teamId === t.id)
        return null
    }
  }
  return null
})

/** Effects that will shape the coming draw, so the captain sees what the power-up did. */
const drawEffects = computed(() => {
  const t = team.value
  if (!t) return []
  const out: { text: string; tone: 'good' | 'bad' }[] = []
  if (t.effects.moveMultiplier > 1)
    out.push({ text: `Move ×${t.effects.moveMultiplier}`, tone: 'good' })
  if (t.effects.nextMoveHalved) out.push({ text: 'Rain: move halved', tone: 'bad' })
  if (t.effects.suitGold)
    out.push({
      text: `${t.effects.suitGold.suit} pay gold (${t.effects.suitGold.drawsLeft} draws)`,
      tone: 'good',
    })
  const boot = state.value.boot
  if (boot && boot.owner !== t.id && boot.until > now.value)
    out.push({ text: `${game.names.team(boot.owner)}’s boot: only ${boot.suit} move`, tone: 'bad' })
  return out
})

// --- The turn, as steps. ---

type Step = 'tile' | 'powerup' | 'draw' | 'walk'
const STEPS: { id: Step; label: string }[] = [
  { id: 'tile', label: 'Tile' },
  { id: 'powerup', label: 'Power-up' },
  { id: 'draw', label: 'Draw' },
  { id: 'walk', label: 'Walk' },
]

const step = computed<Step | null>(() => {
  const t = team.value
  if (!t) return null
  if (my.drawPhase !== 'idle') return 'draw'
  switch (t.status.kind) {
    case 'working':
      return 'tile'
    case 'ready':
      return t.effects.itemUsedHere || my.skippedPowerup || usableCount.value === 0
        ? 'draw'
        : 'powerup'
    case 'drawn':
    case 'moving':
      return 'walk'
    case 'idle':
      return null
  }
})
const stepIndex = computed(() => STEPS.findIndex((s) => s.id === step.value))

/** Something outside the turn's steps holds the team: game state, a gem to steal, ice, a match. */
const blocker = computed(() => {
  if (state.value.phase !== 'running') return 'phase'
  if (stealing.value) return 'stealing'
  if (frozen.value && my.drawPhase === 'idle') return 'frozen'
  if (team.value?.matchId !== null && my.drawPhase === 'idle') return 'match'
  if (animating.value && my.drawPhase === 'idle') return 'animating'
  return null
})

// --- Draw ---

const confirmingDraw = ref(false)
watch(step, () => (confirmingDraw.value = false))

function onPick() {
  void my.pickCard().then(() => {
    if (my.drawPhase === 'idle') cardDraw.value?.reset()
  })
}

const outcomeLines = computed(() => {
  const o = my.lastDraw
  if (!o) return []
  const lines: { text: string; tone: 'good' | 'bad' | 'info' }[] = []
  if (o.restarted)
    lines.push({
      text: 'Wrong suit under a rival’s boot: no move, and your tile restarts.',
      tone: 'bad',
    })
  else if (o.joker)
    lines.push({
      text: `Joker! Your team ${effectText(o.joker)}. Then move ${o.steps}.`,
      tone: 'info',
    })
  else lines.push({ text: `Move ${o.steps} ${o.steps === 1 ? 'tile' : 'tiles'}.`, tone: 'good' })
  if (o.freeItem) lines.push({ text: `Free item: ${itemName(o.freeItem)}!`, tone: 'good' })
  else if (o.card.kind === 'suited' && (o.card.rank === 7 || o.card.rank === 14))
    lines.push({ text: 'A free item, but your inventory is full: it was lost.', tone: 'bad' })
  if (o.suitGold > 0) lines.push({ text: `+${o.suitGold} gold from your suit item.`, tone: 'good' })
  return lines
})

/** What the card was worth before effects, to explain a multiplied move. */
const baseSteps = computed(() => {
  const card = my.lastDraw?.card
  if (!card) return null
  return card.kind === 'joker' ? 1 : card.rank
})

// --- Other actions ---

const rivals = computed(() =>
  [...state.value.teams.values()].filter((t) => t.id !== team.value?.id),
)
const routeSteps = computed(() => (my.route ? my.route.length - 1 : 0))

/** Using an item from the inventory list goes back to the power-up step, where targeting shows. */
function use(item: Item) {
  my.skippedPowerup = false
  void my.useItem(item)
}

async function discard(item: Item) {
  if (window.confirm(`Throw away ${itemName(item)}?`)) await my.act({ kind: 'discard', item })
}

async function login() {
  await my.login(codeInput.value)
  if (my.team) codeInput.value = ''
}
</script>

<template>
  <section class="flex flex-col gap-3 p-4 text-sm">
    <!-- Login -->
    <form v-if="!team" class="flex flex-col gap-2" @submit.prevent="login">
      <h2 class="font-semibold text-slate-100">Manage your team</h2>
      <p class="text-xs text-slate-400">
        Team captains enter their team code to use power-ups, draw cards and pick routes. Anyone can
        watch without one.
      </p>
      <div class="flex gap-2">
        <input
          v-model="codeInput"
          type="password"
          autocomplete="off"
          placeholder="Team code"
          aria-label="Team code"
          class="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
        />
        <button
          type="submit"
          class="rounded-md bg-amber-500 px-3 py-1.5 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
          :disabled="my.pending || !codeInput.trim()"
        >
          Log in
        </button>
      </div>
      <p v-if="my.error" role="alert" class="text-xs text-red-300">{{ my.error }}</p>
    </form>

    <template v-else>
      <header class="flex items-center gap-2">
        <span class="size-3 rounded-full" :style="{ background: color }" aria-hidden="true" />
        <h2 class="font-bold" :style="{ color }">{{ team.name }}</h2>
        <span class="text-amber-300 tabular-nums">{{ team.gold }}g</span>
        <span class="text-xs text-slate-500 tabular-nums">· {{ team.cardsLeft }} cards</span>
        <button
          type="button"
          class="ml-auto rounded px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-800"
          @click="emit('locate')"
        >
          Find
        </button>
        <button
          type="button"
          class="rounded px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-800"
          @click="my.logout()"
        >
          Log out
        </button>
      </header>

      <p
        v-if="my.error"
        role="alert"
        class="rounded-md bg-red-950/60 px-3 py-2 text-xs text-red-200"
      >
        {{ my.error }}
      </p>

      <!-- Turn steps -->
      <ol v-if="step" class="grid grid-cols-4 gap-1" aria-label="Your turn">
        <li
          v-for="(s, i) in STEPS"
          :key="s.id"
          class="flex flex-col items-center gap-1 text-[11px]"
          :class="
            i === stepIndex
              ? 'font-semibold text-amber-200'
              : i < stepIndex
                ? 'text-slate-400'
                : 'text-slate-600'
          "
          :aria-current="i === stepIndex ? 'step' : undefined"
        >
          <span
            class="h-1.5 w-full rounded-full"
            :class="
              i === stepIndex ? 'bg-amber-400' : i < stepIndex ? 'bg-slate-500' : 'bg-slate-800'
            "
          />
          <span>{{ i < stepIndex ? '✓ ' : '' }}{{ s.label }}</span>
        </li>
      </ol>

      <!-- What holds the team outside its turn -->
      <div v-if="blocker" class="rounded-lg border border-slate-700/60 bg-slate-950/50 p-3">
        <template v-if="blocker === 'phase'">
          <p class="text-slate-300">
            {{ state.phase === 'setup' ? 'The game has not started yet.' : 'The game is over.' }}
          </p>
        </template>
        <template v-else-if="blocker === 'stealing' && stealing">
          <p class="font-semibold text-emerald-300">You won the match! Pick a gem to steal.</p>
          <p class="text-xs text-slate-400">Choose before {{ clock(stealing.deadline) }}.</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="gem in stealing.options"
              :key="gem"
              type="button"
              class="flex items-center gap-2 rounded-md border border-slate-600 px-3 py-1.5 capitalize hover:bg-slate-800 disabled:opacity-50"
              :disabled="my.pending"
              @click="my.act({ kind: 'steal_gem', gem })"
            >
              <span class="size-3 rotate-45" :style="{ background: GEM_COLORS[gem] }" />
              {{ gem }}
            </button>
          </div>
        </template>
        <template v-else-if="blocker === 'frozen' && frozen">
          <p class="font-semibold text-sky-300">❄ Frozen until {{ clock(frozen) }}</p>
          <p class="text-xs text-slate-400">
            You can’t draw or use power-ups while frozen. Hold a Monk’s Pendant to block the next
            freeze.
          </p>
        </template>
        <template v-else-if="blocker === 'match'">
          <p class="font-semibold text-red-300">⚔ In a match</p>
          <p class="text-xs text-slate-400">
            The first team to finish the match challenge wins. See the Events tab.
          </p>
        </template>
        <template v-else>
          <p class="text-slate-300">On the move…</p>
        </template>
      </div>

      <!-- Step 1: the tile -->
      <div v-else-if="step === 'tile'" class="step-card">
        <h3 class="step-title">Complete your tile</h3>
        <div v-if="task" class="mt-1">
          <div class="flex justify-between gap-2 text-xs">
            <span class="font-medium text-amber-100">{{ task.challenge.name }}</span>
            <span class="text-slate-400 tabular-nums">{{ task.done }}/{{ task.needed }}</span>
          </div>
          <p class="mt-0.5 text-xs text-slate-400">{{ task.challenge.description }}</p>
          <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              class="h-full rounded-full transition-[width] duration-500"
              :style="{ width: `${(task.done / task.needed) * 100}%`, background: color }"
            />
          </div>
        </div>
        <p class="mt-3 text-xs text-slate-400">
          🔒 Power-ups unlock when the tile is done. Then you pick one (or none) before drawing.
        </p>
      </div>

      <!-- Step 2: power-up -->
      <div v-else-if="step === 'powerup'" class="step-card border-emerald-500/40">
        <h3 class="step-title">Use a power-up before you draw?</h3>
        <p class="text-xs text-slate-400">
          You may use <strong class="text-slate-200">one item</strong> on this tile. Once the card
          is drawn it’s too late, so decide now.
        </p>

        <div
          v-if="my.targeting"
          class="mt-3 rounded-lg border border-orange-500/50 bg-orange-950/30 p-3"
          role="status"
        >
          <p class="font-semibold text-orange-200">Using {{ itemName(my.targeting.item) }}</p>
          <template v-if="my.targeting.kind === 'team'">
            <p class="text-xs text-slate-400">Pick a rival team.</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                v-for="rival in rivals"
                :key="rival.id"
                type="button"
                class="rounded-md border px-3 py-1 hover:bg-slate-800 disabled:opacity-50"
                :style="{ borderColor: teamColor(rival), color: teamColor(rival) }"
                :disabled="my.pending"
                @click="my.useOn({ kind: 'team', teamId: rival.id })"
              >
                {{ rival.name }}
              </button>
            </div>
          </template>
          <p v-else class="text-xs text-slate-400">
            Tap one of the orange-ringed tiles on the map (within 10 steps of you).
          </p>
          <button
            type="button"
            class="mt-2 text-xs text-slate-400 underline"
            @click="my.targeting = null"
          >
            Cancel
          </button>
        </div>

        <div class="mt-3">
          <PowerUpPicker
            :team="team"
            :now="now"
            :pending="my.pending"
            @use="my.useItem"
            @discard="discard"
          />
        </div>

        <button
          type="button"
          class="mt-4 w-full rounded-lg border border-slate-600 py-2 text-slate-200 hover:bg-slate-800"
          @click="my.skippedPowerup = true"
        >
          No power-up: go to the draw →
        </button>
      </div>

      <!-- Step 3: draw -->
      <div v-else-if="step === 'draw'" class="step-card border-violet-500/40">
        <h3 class="step-title">
          {{ my.drawPhase === 'revealed' ? 'Your card' : 'Pick a card' }}
        </h3>

        <template v-if="my.drawPhase !== 'revealed'">
          <p v-if="usedHere" class="text-xs text-emerald-300">
            ✓ Used {{ itemName(usedHere) }} on this tile.
          </p>
          <p v-else-if="usableCount === 0" class="text-xs text-slate-400">
            No power-ups to use right now.
          </p>
          <p v-else class="text-xs text-slate-400">
            Drawing without a power-up.
            <button
              v-if="my.drawPhase === 'idle'"
              type="button"
              class="text-sky-300 underline"
              @click="my.skippedPowerup = false"
            >
              Back to power-ups
            </button>
          </p>
          <ul v-if="drawEffects.length" class="mt-2 flex flex-wrap gap-1.5">
            <li
              v-for="fx in drawEffects"
              :key="fx.text"
              class="rounded-full px-2 py-0.5 text-[11px] font-medium"
              :class="
                fx.tone === 'good'
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-red-500/15 text-red-300'
              "
            >
              {{ fx.text }}
            </li>
          </ul>
        </template>

        <CardDraw
          ref="cardDraw"
          :result="my.lastDraw?.card ?? null"
          :disabled="my.pending || team.cardsLeft === 0 || my.drawPhase === 'revealed'"
          @pick="onPick"
          @revealed="my.cardRevealed()"
        />
        <p v-if="my.drawPhase === 'idle'" class="-mt-3 text-center text-xs text-slate-500">
          Tap a card to draw it.
        </p>
        <p v-else-if="my.drawPhase === 'picking'" class="-mt-3 text-center text-xs text-slate-400">
          Drawing…
        </p>

        <div v-if="my.drawPhase === 'revealed' && my.lastDraw" class="reveal-in">
          <ul class="flex flex-col gap-1">
            <li
              v-for="line in outcomeLines"
              :key="line.text"
              class="font-semibold"
              :class="{
                'text-emerald-300': line.tone === 'good',
                'text-red-300': line.tone === 'bad',
                'text-fuchsia-300': line.tone === 'info',
              }"
            >
              {{ line.text }}
            </li>
          </ul>
          <p
            v-if="baseSteps !== null && baseSteps !== my.lastDraw.steps && !my.lastDraw.restarted"
            class="text-xs text-slate-400"
          >
            {{ cardLabel(my.lastDraw.card) }} is worth {{ baseSteps }}; your effects made it
            {{ my.lastDraw.steps }}.
          </p>
          <button
            type="button"
            class="mt-3 w-full rounded-lg bg-amber-500 py-2 font-bold text-slate-950 hover:bg-amber-400"
            @click="my.finishDraw()"
          >
            {{ my.lastDraw.restarted ? 'Back to your tile' : 'Choose your route →' }}
          </button>
        </div>
      </div>

      <!-- Step 4: walk (route picking; to be reworked next) -->
      <div v-else-if="step === 'walk'" class="step-card">
        <template v-if="team.status.kind === 'drawn'">
          <div class="flex gap-3">
            <PlayingCard :card="team.status.card" />
            <div class="flex flex-col gap-1">
              <p class="font-semibold text-slate-100">Move {{ team.status.length }} tiles</p>
              <p v-if="team.status.length < team.status.steps" class="text-xs text-slate-400">
                The card is worth {{ team.status.steps }}, but no walk is that long.
              </p>
              <p class="text-xs text-slate-400">
                Point at the map (or tap it) to pick a route. Rings mark where you can end. Click to
                lock it.
              </p>
            </div>
          </div>
          <p v-if="my.route" class="mt-3 text-xs text-slate-300">
            {{ my.routeLocked ? 'Route locked' : 'Previewing' }}: {{ routeSteps }} steps to tile #{{
              my.route.at(-1)
            }}
          </p>
          <div class="mt-2 flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-lg bg-emerald-500 py-2 font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
              :disabled="!my.route || my.pending"
              @click="my.confirmRoute()"
            >
              Go!
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-600 px-3 py-2 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              :disabled="!my.route"
              @click="my.clearRoute()"
            >
              Clear
            </button>
          </div>
        </template>
        <template v-else-if="pause?.kind === 'shop'">
          <p class="font-semibold text-amber-200">You’re passing a shop.</p>
          <p class="text-xs text-slate-400">Buy what you like, then carry on walking.</p>
          <div class="mt-2 flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-lg bg-amber-500 py-2 font-semibold text-slate-950 hover:bg-amber-400"
              @click="emit('openShop')"
            >
              Browse the shop
            </button>
            <button
              type="button"
              class="flex-1 rounded-lg border border-slate-600 py-2 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
              :disabled="my.pending"
              @click="my.act({ kind: 'close_shop' })"
            >
              Leave and walk on
            </button>
          </div>
        </template>
        <template v-else-if="pause?.kind === 'choose_opponent'">
          <p class="font-semibold text-red-300">Several teams are here. Who do you challenge?</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="id in pause.candidates"
              :key="id"
              type="button"
              class="rounded-md border border-slate-600 px-3 py-1.5 hover:bg-slate-800 disabled:opacity-50"
              :disabled="my.pending"
              @click="my.act({ kind: 'choose_opponent', opponent: id })"
            >
              {{ game.names.team(id) }}
            </button>
          </div>
        </template>
        <p v-else class="text-slate-300">On the move…</p>
      </div>

      <button
        v-if="atShop && pause?.kind !== 'shop' && !blocker"
        type="button"
        class="w-full rounded-lg border border-amber-500/50 py-1.5 text-amber-200 hover:bg-amber-500/10"
        @click="emit('openShop')"
      >
        You’re on a shop: browse it
      </button>

      <!-- Inventory, outside the power-up step -->
      <details v-if="step !== 'powerup'" class="group rounded-lg border border-slate-800">
        <summary
          class="flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400 uppercase"
        >
          Items ({{ [...team.items.values()].reduce((a, b) => a + b, 0) }}/10)
          <span class="text-slate-600 group-open:rotate-180">▾</span>
        </summary>
        <div class="px-3 pb-3">
          <PowerUpPicker
            :team="team"
            :now="now"
            :pending="my.pending"
            :locked="step === 'tile'"
            @use="use"
            @discard="discard"
          />
        </div>
      </details>
    </template>
  </section>
</template>

<style scoped>
@reference '../assets/main.css';

.step-card {
  @apply rounded-lg border border-slate-700/60 bg-slate-950/50 p-3;
}
.step-title {
  @apply mb-1 font-semibold text-slate-100;
}
.reveal-in {
  animation: reveal-in 0.4s ease-out;
}
@keyframes reveal-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
</style>
