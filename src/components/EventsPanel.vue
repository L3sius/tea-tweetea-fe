<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Challenge } from '@/domain/challenge'
import { challengeProgress, type Names } from '@/domain/describe'
import type { GameState, Instance, Match, Minigame } from '@/domain/game'
import type { ChallengeId, InstanceId } from '@/domain/ids'
import { teamColor } from '@/ui/colors'
import { timeFrom } from '@/ui/format'
import { TtPanel, TtProgressBar, TtText } from '@/ui/tt'

const props = defineProps<{
  state: GameState
  challenges: ReadonlyMap<ChallengeId, Challenge>
  names: Names
  now: Date
}>()

const open = ref<string | null>(null)
const toggle = (key: string) => (open.value = open.value === key ? null : key)
/** Finished minigames and matches stay out of the way until asked for. */
const showResults = ref(false)

type Bar = { name: string; color: string; done: number; needed: number; note: string | null }

function bars(
  instanceId: InstanceId,
  only?: Set<number>,
): { challenge: Challenge | null; bars: Bar[] } {
  const instance: Instance | undefined = props.state.instances.get(instanceId)
  const challenge = (instance && props.challenges.get(instance.challengeId)) ?? null
  const out: Bar[] = []
  for (const team of props.state.teams.values()) {
    if (only && !only.has(team.id)) continue
    const p = challenge ? challengeProgress(challenge, instance, team.id) : { done: 0, needed: 1 }
    out.push({
      name: team.name,
      color: teamColor(team),
      done: p.done,
      needed: p.needed,
      note: instance?.done.has(team.id) ? 'done' : null,
    })
  }
  out.sort((a, b) => b.done / b.needed - a.done / a.needed)
  return { challenge, bars: out }
}

function minigameRow(m: Minigame) {
  const { challenge, bars: list } = bars(m.instanceId)
  // Contribution minigames count up to the per-team cap rather than to the task's target.
  const cap = m.scoring.kind === 'contribution' ? m.scoring.cap : null
  const places = new Map(m.finished.map((id, i) => [props.names.team(id), i + 1]))
  return {
    key: `minigame-${m.id}`,
    kind: 'Minigame',
    title: challenge?.name ?? 'Unknown challenge',
    description: challenge?.description ?? '',
    subtitle: `Opened by ${props.names.team(m.initiator)} (double gold)`,
    scoring:
      m.scoring.kind === 'race'
        ? `Race: first to finish wins ${m.scoring.payouts.join(' / ')} gold`
        : `Every unit counts, up to ${m.scoring.cap} per team, for ${m.scoring.goldPerUnit} gold each`,
    deadline: m.deadline,
    bars: list.map((b) => ({
      ...b,
      ...(cap === null ? {} : { done: Math.min(b.done, cap), needed: cap }),
      note: places.get(b.name) !== undefined ? `#${places.get(b.name)}` : b.note,
    })),
    result: m.payouts
      ? m.payouts.length
        ? m.payouts
            .slice()
            .sort((a, b) => b.gold - a.gold)
            .map((p) => `${props.names.team(p.teamId)} +${p.gold}g`)
            .join(' · ')
        : 'Nobody scored'
      : null,
  }
}

function matchRow(m: Match) {
  const { challenge, bars: list } = bars(m.instanceId, new Set([m.mover, m.defender]))
  const o = m.outcome
  const result =
    o.kind === 'won'
      ? `${props.names.team(o.winner)} won${o.stolen ? ` and stole the ${o.stolen} gem` : ''}`
      : o.kind === 'abandoned'
        ? 'Abandoned: nobody finished in time'
        : o.kind === 'stealing'
          ? `${props.names.team(o.winner)} won and is choosing a gem to steal`
          : null
  return {
    key: `match-${m.id}`,
    kind: 'Match',
    title: `${props.names.team(m.mover)} vs ${props.names.team(m.defender)}`,
    description: challenge ? `${challenge.name}: ${challenge.description}` : '',
    subtitle: `${props.names.team(m.mover)} walked into ${props.names.team(m.defender)}`,
    scoring: 'First to finish wins and may steal a gem',
    deadline: m.deadline,
    bars: list,
    result,
  }
}

const live = computed(() => [
  ...[...props.state.minigames.values()].filter((m) => m.payouts === null).map(minigameRow),
  ...[...props.state.matches.values()]
    .filter((m) => m.outcome.kind === 'open' || m.outcome.kind === 'stealing')
    .map(matchRow),
])

const past = computed(() =>
  [
    ...[...props.state.minigames.values()].filter((m) => m.payouts !== null).map(minigameRow),
    ...[...props.state.matches.values()]
      .filter((m) => m.outcome.kind === 'won' || m.outcome.kind === 'abandoned')
      .map(matchRow),
  ].sort((a, b) => b.deadline.getTime() - a.deadline.getTime()),
)
</script>

<template>
  <TtPanel title="Minigames" width="100%" :padding="12" :gap="12">
    <TtText v-if="live.length === 0" :size="1" color="muted">
      No minigames or matches right now. Landing on a red tile opens one.
    </TtText>
    <ul class="flex w-full flex-col gap-2">
      <li
        v-for="row in live"
        :key="row.key"
        class="tt-sprite-display flex flex-col items-center gap-1 px-2 py-1"
      >
        <TtText :size="1" font="bold" :color="row.kind === 'Match' ? 'red' : 'orange'">
          {{ row.kind }}
        </TtText>
        <TtText :size="2">{{ row.title }}</TtText>
        <TtText :size="1" color="white">{{ row.description }}</TtText>
        <TtText :size="1" color="muted">
          {{ row.scoring }} · ends {{ timeFrom(row.deadline, now) }}
        </TtText>
        <TtText v-if="row.result" :size="1" color="green">{{ row.result }}</TtText>
        <ul class="mt-1 flex w-full flex-col gap-1">
          <li v-for="bar in row.bars" :key="bar.name" class="flex items-center gap-2">
            <TtText
              :size="1"
              font="bold"
              :color="bar.color"
              align="right"
              block
              class="w-16 shrink-0 truncate"
            >
              {{ bar.name }}
            </TtText>
            <TtProgressBar
              class="min-w-0 flex-1"
              width="auto"
              :height="21"
              :value="bar.done"
              :max="bar.needed"
              :color="bar.color"
            />
            <TtText :size="1" color="white" align="left" block class="w-14 shrink-0">
              {{ bar.note ?? `${bar.done}/${bar.needed}` }}
            </TtText>
          </li>
        </ul>
      </li>
    </ul>

    <button
      v-if="past.length"
      type="button"
      class="tt-link tt-1"
      :aria-expanded="showResults"
      @click="showResults = !showResults"
    >
      {{ showResults ? 'Hide' : 'Show' }} finished ({{ past.length }})
    </button>
    <ul v-if="showResults" class="flex w-full flex-col gap-1">
      <li v-for="row in past" :key="row.key" class="flex flex-col items-center">
        <button
          type="button"
          class="tt-link flex w-full flex-wrap items-baseline justify-center gap-x-2"
          :aria-expanded="open === row.key"
          @click="toggle(row.key)"
        >
          <TtText :size="1" color="muted">{{ row.kind }}</TtText>
          <TtText :size="1" :color="open === row.key ? 'white' : 'yellow'">{{ row.title }}</TtText>
          <TtText :size="1" color="muted">{{ timeFrom(row.deadline, now) }}</TtText>
        </button>
        <div v-if="open === row.key" class="flex w-full flex-col items-center gap-1 pt-1 pb-2">
          <TtText :size="1" color="white">{{ row.description }}</TtText>
          <TtText :size="1" color="muted">{{ row.subtitle }}</TtText>
          <TtText :size="1" color="green">{{ row.result }}</TtText>
          <ul class="mt-1 flex w-full flex-col gap-1">
            <li v-for="bar in row.bars" :key="bar.name" class="flex items-center gap-2">
              <TtText
                :size="1"
                font="bold"
                :color="bar.color"
                align="right"
                block
                class="w-16 shrink-0 truncate"
              >
                {{ bar.name }}
              </TtText>
              <TtProgressBar
                class="min-w-0 flex-1"
                width="auto"
                :height="21"
                :value="bar.done"
                :max="bar.needed"
                :color="bar.color"
              />
              <TtText :size="1" color="white" align="left" block class="w-14 shrink-0">
                {{ bar.note ?? `${bar.done}/${bar.needed}` }}
              </TtText>
            </li>
          </ul>
        </div>
      </li>
    </ul>
  </TtPanel>
</template>
