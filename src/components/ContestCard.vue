<script setup lang="ts">
import { computed } from 'vue'
import hourglass from '@/assets/tt/img/icons/hourglass.png'
import { ordinal, standingText, timeLeft, type Contest } from '@/domain/contests'
import type { Names } from '@/domain/describe'
import type { Team } from '@/domain/game'
import type { TeamId } from '@/domain/ids'
import { teamColor } from '@/ui/colors'
import { TtProgressBar, TtText } from '@/ui/tt'

// One minigame: what it asks, how long is left, what it pays, and each team's standing,
// leader first. Each team gets a full line for its name, so long names are never cut short.

const props = defineProps<{
  contest: Contest
  teams: ReadonlyMap<TeamId, Team>
  names: Names
  now: Date
}>()

const colorOf = (id: TeamId) => {
  const team = props.teams.get(id)
  return team ? teamColor(team) : 'var(--osrs-white)'
}

const stakeTitle = computed(() => {
  const stake = props.contest.stake
  return stake.kind === 'places' ? 'Race: first to finish wins' : 'Every one counts'
})
</script>

<template>
  <article class="contest tt-sprite-display flex w-full flex-col items-center gap-1.5 px-2 py-1.5">
    <TtText :size="1" font="bold" color="orange">Minigame</TtText>
    <TtText as="h3" :size="2" color="yellow" class="[overflow-wrap:anywhere]">
      {{ contest.title }}
    </TtText>

    <p v-if="contest.live" class="timer">
      <img :src="hourglass" alt="" width="18" height="29" />
      <span>
        Time left: <strong>{{ timeLeft(contest.deadline, now) }}</strong>
      </span>
      <img :src="hourglass" alt="" width="18" height="29" />
    </p>

    <TtText v-if="contest.description" :size="1" color="white">{{ contest.description }}</TtText>

    <!-- What it pays. -->
    <section class="stakes" :aria-label="stakeTitle">
      <p class="stakes-title">{{ stakeTitle }}</p>
      <ul v-if="contest.stake.kind === 'places'" class="payouts">
        <li v-for="(gold, i) in contest.stake.payouts" :key="i">
          <span class="payout-place">{{ ordinal(i + 1) }}</span>
          <!-- The coins say it is gold, which keeps four places on one row. -->
          <span class="payout-gold" :title="`${gold} gold`">
            <span class="tt-sprite tt-icon-coins size-6" aria-hidden="true" />{{ gold }}
            <span class="sr-only">gold</span>
          </span>
        </li>
      </ul>
      <p v-else class="stakes-line">
        <span class="tt-sprite tt-icon-coins size-6" aria-hidden="true" />
        {{ contest.stake.goldPerUnit }} gold each, up to {{ contest.stake.cap }} per team
      </p>
    </section>

    <TtText v-if="contest.initiator !== null" :size="1" color="muted">
      <span :style="{ color: colorOf(contest.initiator) }">{{
        names.team(contest.initiator)
      }}</span>
      opened it: double gold
    </TtText>
    <TtText v-if="contest.result" :size="1" color="green">{{ contest.result }}</TtText>

    <!-- Each team's standing: its name and how it stands on one line, the bar below. -->
    <ul class="standings">
      <li v-for="s in contest.standings" :key="s.teamId">
        <div class="flex items-baseline justify-between gap-2">
          <TtText
            :size="1"
            font="bold"
            :color="colorOf(s.teamId)"
            align="left"
            class="min-w-0 [overflow-wrap:anywhere]"
          >
            {{ names.team(s.teamId) }}
          </TtText>
          <TtText
            :size="1"
            :color="s.place !== null || s.finished ? 'green' : 'white'"
            class="shrink-0"
          >
            {{ standingText(s, contest.stake, contest.live) }}
          </TtText>
        </div>
        <TtProgressBar
          width="auto"
          :height="9"
          :value="s.done"
          :max="s.needed"
          :color="colorOf(s.teamId)"
        />
      </li>
    </ul>
  </article>
</template>

<style scoped>
/* The countdown, in a framed strip between two hourglasses. */
.timer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 3px 12px;
  border: 3px solid #000;
  background: var(--brown-deep);
  box-shadow: inset 0 0 0 2px var(--stone-hi);
  color: var(--osrs-white);
  font-family: var(--font-bold);
  font-size: var(--fs-1);
  text-shadow: 1px 1px 0 #000;
}
.timer img {
  image-rendering: pixelated;
}
.timer strong {
  color: var(--osrs-orange);
  font-weight: normal;
}
.stakes {
  container-type: inline-size;
  width: 100%;
  padding: 4px 6px 6px;
  border: 2px solid #000;
  background: rgb(0 0 0 / 0.25);
  box-shadow: inset 0 0 0 1px var(--stone-hi);
  font-family: var(--font-small);
  font-size: var(--fs-1);
  text-shadow: 1px 1px 0 #000;
}
.stakes-title {
  margin-bottom: 4px;
  color: var(--text-muted);
  text-align: center;
}
.stakes-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--osrs-white);
  text-align: center;
}
/* Four places across, or two by two where the panel is narrow (a phone). */
.payouts {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}
@container (max-width: 230px) {
  .payouts {
    grid-template-columns: repeat(2, 1fr);
  }
}
.payouts li {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.payout-place {
  color: var(--osrs-orange);
}
.payout-gold {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--osrs-white);
}
.standings {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
</style>
