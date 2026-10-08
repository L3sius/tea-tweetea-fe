<script setup lang="ts">
import { useIntervalFn, useNow } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'
import {
  cardLabel,
  challengeProgress,
  clock,
  effectText,
  effortText,
  itemName,
} from '@/domain/describe'
import type { GameState, Team } from '@/domain/game'
import { whyNotUsable } from '@/domain/items'
import type { Item } from '@/domain/vocabulary'
import { useGameStore } from '@/stores/game'
import { useTeamStore } from '@/stores/team'
import { teamColor } from '@/ui/colors'
import {
  GEM_NAMES,
  TtButton,
  TtDisplayBox,
  TtDivider,
  TtGemTracker,
  TtPanel,
  TtProgressBar,
  TtSlot,
  TtText,
} from '@/ui/tt'
import CardDraw from './CardDraw.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import ItemSlot from './ItemSlot.vue'
import PlayingCard from './PlayingCard.vue'
import PowerUpPicker from './PowerUpPicker.vue'

const emit = defineEmits<{ openShop: [] }>()

const game = useGameStore()
const my = useTeamStore()
const now = useNow({ scheduler: (tick) => useIntervalFn(tick, 1_000) })
const codeInput = ref('')
const cardDraw = useTemplateRef('cardDraw')

const team = computed(() => my.team)
const state = computed(() => game.state as GameState)
const color = computed(() => (team.value ? teamColor(team.value) : 'var(--text-muted)'))

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
  const effort = effortText(challenge, instance, instance.progress.get(t.id), now.value)
  return { challenge, effort, ...challengeProgress(challenge, instance, t.id) }
})

/** The tile the team stands on. */
const here = computed(() => (team.value ? game.board?.tiles.get(team.value.position) : undefined))

const usableCount = computed(() => {
  const t = team.value
  if (!t) return 0
  return [...my.items].filter(
    ([item, n]) => n > 0 && whyNotUsable(t, item, now.value, here.value) === null,
  ).length
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
    out.push({ text: `Move x${t.effects.moveMultiplier}`, tone: 'good' })
  if (t.effects.nextMoveHalved) out.push({ text: 'Rain: move halved', tone: 'bad' })
  if (t.effects.suitGold)
    out.push({
      text: `${t.effects.suitGold.suit} pay gold (${t.effects.suitGold.drawsLeft} draws)`,
      tone: 'good',
    })
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

const TONE_COLOR = { good: 'green', bad: 'red', info: 'cyan' } as const

const outcomeLines = computed(() => {
  const o = my.lastDraw
  if (!o) return []
  const lines: { text: string; tone: 'good' | 'bad' | 'info' }[] = []
  if (o.joker)
    lines.push({
      text: `Joker! Your team ${effectText(o.joker)}. Then move ${o.steps}.`,
      tone: 'info',
    })
  else lines.push({ text: `Move ${o.steps} ${o.steps === 1 ? 'tile' : 'tiles'}.`, tone: 'good' })
  if (o.freeItem)
    lines.push({
      text: o.freeItem.item ? `Free item: ${itemName(o.freeItem.item)}!` : 'A free item!',
      tone: 'good',
    })
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

/**
 * Rivals a team-targeted item can hit. Every such item is hostile, and a team hit by one is
 * shielded from them for a while, so shielded teams are left out and listed apart.
 */
const isShielded = (t: Team) => t.shieldUntil !== null && t.shieldUntil > now.value
const others = computed(() =>
  [...state.value.teams.values()].filter((t) => t.id !== team.value?.id),
)
const rivals = computed(() => others.value.filter((t) => !isShielded(t)))
const shieldedRivals = computed(() => others.value.filter(isShielded))

/** Using an item goes back to the power-up step, where targeting shows. */
function use(item: Item) {
  my.skippedPowerup = false
  void my.useItem(item)
}

/** The item waiting on the drop dialog's answer. */
const dropping = ref<Item | null>(null)

function discard(item: Item) {
  dropping.value = item
}

async function confirmDrop() {
  const item = dropping.value
  dropping.value = null
  if (item) await my.act({ kind: 'discard', item })
}

async function login() {
  await my.login(codeInput.value)
  if (my.team) codeInput.value = ''
}
</script>

<template>
  <!-- Login -->
  <TtPanel
    v-if="!team"
    title="Manage your team"
    width="100%"
    :padding="15"
    :gap="12"
    class="min-h-full"
  >
    <form class="flex flex-col items-center gap-3" @submit.prevent="login">
      <TtText :size="1" color="white" class="max-w-[340px]">
        Team captains enter their team code to use power-ups, draw cards and pick routes. Anyone can
        watch without one.
      </TtText>
      <div class="tt-sprite-display box-border flex h-[72px] w-[300px] max-w-full items-center">
        <input
          v-model="codeInput"
          type="password"
          autocomplete="off"
          placeholder="Team code"
          aria-label="Team code"
          class="tt-2 w-full border-0 bg-transparent text-center outline-none"
          style="color: var(--osrs-white); caret-color: var(--osrs-yellow)"
        />
      </div>
      <TtText v-if="my.error" role="alert" :size="1" color="red">{{ my.error }}</TtText>
      <TtButton type="submit" :disabled="my.pending || !codeInput.trim()">Log in</TtButton>
    </form>
  </TtPanel>

  <TtPanel v-else width="100%" :padding="15" :gap="12" class="min-h-full">
    <template #title>
      <span :style="{ color }">Team {{ team.name }}</span>
    </template>

    <!-- What the team holds, on one line: its gems, then its gold. -->
    <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      <TtGemTracker :held="team.gems" :scale="1" :slots="false" />
      <span class="flex items-center gap-1" :title="`${team.gold} gold`">
        <span class="tt-sprite tt-icon-coins size-6" aria-hidden="true" />
        <TtText :size="2" color="yellow">{{ team.gold }}</TtText>
      </span>
    </div>

    <TtText v-if="my.error" role="alert" :size="1" color="red">{{ my.error }}</TtText>

    <TtDivider />

    <!-- Turn steps -->
    <ol
      v-if="step"
      class="flex flex-wrap items-center justify-center gap-x-2"
      aria-label="Your turn"
    >
      <li
        v-for="(s, i) in STEPS"
        :key="s.id"
        class="flex items-center gap-2"
        :aria-current="i === stepIndex ? 'step' : undefined"
      >
        <TtText
          :size="1"
          :font="i === stepIndex ? 'bold' : 'small'"
          :color="i === stepIndex ? 'yellow' : i < stepIndex ? 'green' : 'muted'"
          :glow="i === stepIndex"
        >
          {{ s.label }}
        </TtText>
        <TtText v-if="i < STEPS.length - 1" :size="1" color="muted" aria-hidden="true">&gt;</TtText>
      </li>
    </ol>

    <!-- What holds the team outside its turn -->
    <div v-if="blocker" class="flex flex-col items-center gap-1.5">
      <TtText v-if="blocker === 'phase'" :size="2" color="white">
        {{ state.phase === 'setup' ? 'The game has not started yet.' : 'The game is over.' }}
      </TtText>
      <template v-else-if="blocker === 'stealing' && stealing">
        <TtText :size="2" color="green" glow>You won the match!</TtText>
        <TtText :size="1" color="white">
          Pick a gem to steal. Choose before {{ clock(stealing.deadline) }}.
        </TtText>
        <div class="mt-1 flex flex-wrap justify-center gap-1">
          <TtSlot
            v-for="gem in stealing.options"
            :key="gem"
            :gem="gem"
            :size="90"
            :label="GEM_NAMES[gem]"
            :title="`Steal the ${GEM_NAMES[gem]}`"
            :empty="my.pending"
            @click="!my.pending && my.act({ kind: 'steal_gem', gem })"
          />
        </div>
      </template>
      <template v-else-if="blocker === 'frozen' && frozen">
        <TtText :size="2" color="cyan" glow>Frozen until {{ clock(frozen) }}</TtText>
        <TtText :size="1" color="white" class="max-w-[340px]">
          You can't draw or use power-ups while frozen. Hold Protect from Magic to block the next
          freeze.
        </TtText>
      </template>
      <template v-else-if="blocker === 'match'">
        <TtText :size="2" color="red" glow>In a match</TtText>
        <TtText :size="1" color="white" class="max-w-[340px]">
          The first team to finish the match challenge wins. See the Events tab.
        </TtText>
      </template>
      <TtText v-else :size="2" color="white">Walking...</TtText>
    </div>

    <!-- Step 1: the tile -->
    <div v-else-if="step === 'tile'" class="flex w-full flex-col items-center gap-1.5">
      <TtText :size="1" color="orange">Current tile</TtText>
      <template v-if="task">
        <TtText :size="2">{{ task.challenge.name }}</TtText>
        <TtText :size="1" color="white" class="max-w-[340px]">
          {{ task.challenge.description }}
        </TtText>
        <TtProgressBar
          :value="task.done"
          :max="task.needed"
          :label="`${task.done} / ${task.needed}`"
          :width="330"
          class="max-w-full"
        />
        <TtText v-if="task.effort" :size="1" color="cyan">{{ task.effort }}</TtText>
      </template>
      <TtText :size="1" color="muted" class="max-w-[340px]">
        Tiles complete automatically from Dink drops. Power-ups unlock when the tile is done.
      </TtText>
    </div>

    <!-- Step 2: power-up -->
    <div v-else-if="step === 'powerup'" class="flex w-full flex-col items-center gap-2">
      <TtText :size="2" color="white">Use a power-up before you draw?</TtText>
      <TtText :size="1" color="muted" class="max-w-[340px]">
        You may use one item on this tile. Once the card is drawn it's too late, so decide now.
      </TtText>

      <div
        v-if="my.targeting"
        class="tt-sprite-display flex w-full flex-col items-center gap-1.5 px-2 py-1"
        role="status"
      >
        <TtText :size="1" color="orange">Using {{ itemName(my.targeting.item) }}</TtText>
        <template v-if="my.targeting.kind === 'team'">
          <TtText :size="1" color="white">
            {{ rivals.length ? 'Pick a rival team.' : 'Every rival is shielded right now.' }}
          </TtText>
          <div class="flex flex-wrap justify-center gap-1.5">
            <TtButton
              v-for="rival in rivals"
              :key="rival.id"
              size="sm"
              :disabled="my.pending"
              @click="my.useOn({ kind: 'team', teamId: rival.id })"
            >
              <span :style="{ color: teamColor(rival) }">{{ rival.name }}</span>
            </TtButton>
          </div>
          <TtText v-for="t in shieldedRivals" :key="t.id" :size="1" color="muted">
            {{ t.name }} is shielded until {{ clock(t.shieldUntil!) }}.
          </TtText>
        </template>
        <TtText v-else :size="1" color="white">
          Click one of the orange-ringed tiles on the map (within 10 steps of you).
        </TtText>
        <button type="button" class="tt-link tt-1" @click="my.targeting = null">Cancel</button>
      </div>

      <PowerUpPicker
        :team="team"
        :items="my.items"
        :here="here"
        :now="now"
        :pending="my.pending"
        @use="my.useItem"
        @discard="discard"
      />

      <TtButton @click="my.skippedPowerup = true">Skip to the draw</TtButton>
    </div>

    <!-- Step 3: draw -->
    <div v-else-if="step === 'draw'" class="flex w-full flex-col items-center gap-1.5">
      <TtText :size="2" color="white">
        {{ my.drawPhase === 'revealed' ? 'Your card' : 'Pick a card' }}
      </TtText>

      <template v-if="my.drawPhase !== 'revealed'">
        <TtText v-if="usedHere" :size="1" color="green">
          Used {{ itemName(usedHere) }} on this tile.
        </TtText>
        <TtText v-else-if="usableCount === 0" :size="1" color="muted">
          No power-ups to use right now.
        </TtText>
        <TtText v-else :size="1" color="muted">
          Drawing without a power-up.
          <button
            v-if="my.drawPhase === 'idle'"
            type="button"
            class="tt-link"
            @click="my.skippedPowerup = false"
          >
            Back to power-ups
          </button>
        </TtText>
        <ul v-if="drawEffects.length" class="flex flex-wrap justify-center gap-x-3">
          <li v-for="fx in drawEffects" :key="fx.text">
            <TtText :size="1" :color="fx.tone === 'good' ? 'green' : 'red'">{{ fx.text }}</TtText>
          </li>
        </ul>
      </template>

      <CardDraw
        ref="cardDraw"
        class="w-full"
        :result="my.lastDraw?.card ?? null"
        :disabled="my.pending || my.drawPhase === 'revealed'"
        @pick="onPick"
        @revealed="my.cardRevealed()"
      />
      <TtText v-if="my.drawPhase === 'idle'" :size="1" color="muted"
        >Click a card to draw it.</TtText
      >
      <TtText v-else-if="my.drawPhase === 'picking'" :size="1" color="white">Drawing...</TtText>

      <div
        v-if="my.drawPhase === 'revealed' && my.lastDraw"
        class="reveal-in flex flex-col items-center gap-1.5"
      >
        <TtText
          v-for="line in outcomeLines"
          :key="line.text"
          :size="2"
          :color="TONE_COLOR[line.tone]"
          glow
        >
          {{ line.text }}
        </TtText>
        <TtText
          v-if="baseSteps !== null && baseSteps !== my.lastDraw.steps"
          :size="1"
          color="white"
        >
          {{ cardLabel(my.lastDraw.card) }} is worth {{ baseSteps }}; your effects made it
          {{ my.lastDraw.steps }}.
        </TtText>
        <TtButton class="mt-1.5" @click="my.finishDraw()"> Choose a path </TtButton>
      </div>
    </div>

    <!-- Step 4: walk -->
    <div v-else-if="step === 'walk'" class="flex w-full flex-col items-center gap-2">
      <template v-if="team.status.kind === 'drawn'">
        <div class="flex items-center gap-3">
          <PlayingCard :card="team.status.card" />
          <div class="flex flex-col items-center gap-1">
            <TtText :size="2" color="white" glow>Move {{ team.status.length }} tiles</TtText>
            <TtText v-if="team.status.length < team.status.steps" :size="1" color="muted">
              The card is worth {{ team.status.steps }}, but no walk is that long.
            </TtText>
          </div>
        </div>
        <TtDisplayBox
          label="Steps left"
          :value="my.stepsLeft"
          :value-color="my.stepsLeft === 0 ? 'var(--osrs-green)' : 'var(--osrs-yellow)'"
          :width="150"
        />
        <TtText v-if="my.stepsLeft > 0" :size="1" color="white" class="max-w-[340px]">
          Click nodes on the map to walk there, one checkpoint at a time. Yellow squares are one
          step away.
        </TtText>
        <TtText v-else :size="1" color="green">Route complete. Press Go! to walk it.</TtText>
        <TtText v-if="my.route" :size="1" color="muted" class="max-w-[340px]">
          Click back along your route to undo steps, or a node off it to reroute from there.
        </TtText>
        <div class="flex flex-wrap justify-center gap-1.5">
          <TtButton
            :disabled="my.stepsLeft !== 0 || !my.route || my.pending"
            @click="my.confirmRoute()"
          >
            Go!
          </TtButton>
          <TtButton size="sm" :disabled="!my.checkpoints.length" @click="my.undoCheckpoint()">
            Undo
          </TtButton>
          <TtButton size="sm" :disabled="!my.route" @click="my.clearRoute()">Clear</TtButton>
        </div>
      </template>
      <template v-else-if="pause?.kind === 'shop'">
        <TtText :size="2">You're passing a shop.</TtText>
        <TtText :size="1" color="white">Buy what you like, then carry on walking.</TtText>
        <div class="flex flex-wrap justify-center gap-1.5">
          <TtButton @click="emit('openShop')">Browse</TtButton>
          <TtButton :disabled="my.pending" @click="my.act({ kind: 'close_shop' })">
            Walk on
          </TtButton>
        </div>
      </template>
      <template v-else-if="pause?.kind === 'choose_opponent'">
        <TtText :size="2" color="red">Several teams are here. Who do you challenge?</TtText>
        <div class="flex flex-wrap justify-center gap-1.5">
          <TtButton
            v-for="id in pause.candidates"
            :key="id"
            size="sm"
            :disabled="my.pending"
            @click="my.act({ kind: 'choose_opponent', opponent: id })"
          >
            {{ game.names.team(id) }}
          </TtButton>
        </div>
      </template>
      <TtText v-else :size="2" color="white">Walking...</TtText>
    </div>

    <TtButton
      v-if="atShop && pause?.kind !== 'shop' && !blocker"
      size="sm"
      @click="emit('openShop')"
    >
      You're on a shop: browse it
    </TtButton>

    <!-- Inventory, outside the power-up step (which shows it above) -->
    <template v-if="step !== 'powerup'">
      <TtDivider />
      <PowerUpPicker
        :team="team"
        :items="my.items"
        :here="here"
        :now="now"
        :pending="my.pending"
        :locked="step === 'tile'"
        @use="use"
        @discard="discard"
      />
    </template>

    <ConfirmDialog
      v-if="dropping"
      title="Drop item"
      :question="`Are you sure you want to drop the ${itemName(dropping)}?`"
      note="It is gone for good: you can't pick it up again."
      @confirm="confirmDrop"
      @cancel="dropping = null"
    >
      <div class="flex flex-col items-center gap-1">
        <ItemSlot :item="dropping" :size="76" />
        <TtText :size="2" color="orange">{{ itemName(dropping) }}</TtText>
      </div>
    </ConfirmDialog>
  </TtPanel>
</template>

<style scoped>
.reveal-in {
  animation: reveal-in 0.4s steps(4, end);
}
@keyframes reveal-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
</style>
