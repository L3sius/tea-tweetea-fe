<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Challenge } from '@/domain/challenge'
import { challengeProgress, type Names } from '@/domain/describe'
import type { GameState, Instance, Match, Minigame } from '@/domain/game'
import type { ChallengeId, InstanceId } from '@/domain/ids'
import { teamColor } from '@/ui/colors'
import { timeFrom } from '@/ui/format'

const props = defineProps<{
  state: GameState
  challenges: ReadonlyMap<ChallengeId, Challenge>
  names: Names
  now: Date
}>()

const open = ref<string | null>(null)
const toggle = (key: string) => (open.value = open.value === key ? null : key)

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

const boot = computed(() => props.state.boot)
</script>

<template>
  <section class="flex flex-col gap-4 p-4 text-sm">
    <div>
      <h2 class="mb-2 text-xs font-semibold tracking-wide text-amber-300 uppercase">
        Happening now
      </h2>
      <p v-if="live.length === 0 && !boot" class="text-slate-500">
        No minigames or matches right now. Landing on a red tile opens one.
      </p>
      <div
        v-if="boot"
        class="mb-2 rounded-lg border border-violet-500/40 bg-violet-950/30 px-3 py-2"
      >
        <p class="font-medium text-violet-200">
          👢 {{ names.team(boot.owner) }}’s {{ boot.suit }} boot
        </p>
        <p class="text-xs text-slate-400">
          Other teams only move on {{ boot.suit }}. Ends {{ timeFrom(boot.until, now) }}.
        </p>
      </div>
      <ul class="flex flex-col gap-2">
        <li
          v-for="row in live"
          :key="row.key"
          class="rounded-lg border px-3 py-2.5"
          :class="
            row.kind === 'Match'
              ? 'border-red-500/40 bg-red-950/20'
              : 'border-amber-500/40 bg-amber-950/20'
          "
        >
          <p class="flex items-baseline gap-2">
            <span
              class="rounded px-1.5 text-[10px] font-bold uppercase"
              :class="
                row.kind === 'Match' ? 'bg-red-500 text-red-950' : 'bg-amber-400 text-amber-950'
              "
              >{{ row.kind }}</span
            >
            <span class="font-semibold text-slate-100">{{ row.title }}</span>
          </p>
          <p class="mt-0.5 text-xs text-slate-400">{{ row.description }}</p>
          <p class="text-xs text-slate-500">
            {{ row.scoring }} · ends {{ timeFrom(row.deadline, now) }}
          </p>
          <p v-if="row.result" class="mt-1 text-xs font-medium text-emerald-300">
            {{ row.result }}
          </p>
          <ul class="mt-2 flex flex-col gap-1">
            <li v-for="bar in row.bars" :key="bar.name" class="flex items-center gap-2 text-xs">
              <span class="w-14 truncate font-medium" :style="{ color: bar.color }">{{
                bar.name
              }}</span>
              <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  class="h-full rounded-full transition-[width] duration-700"
                  :style="{ width: `${(bar.done / bar.needed) * 100}%`, background: bar.color }"
                />
              </div>
              <span class="w-14 text-right text-slate-400 tabular-nums">
                {{ bar.note ?? `${bar.done}/${bar.needed}` }}
              </span>
            </li>
          </ul>
        </li>
      </ul>
    </div>

    <div>
      <h2 class="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Results</h2>
      <p v-if="past.length === 0" class="text-slate-500">No finished minigames or matches yet.</p>
      <ul class="flex flex-col divide-y divide-slate-800 rounded-lg border border-slate-800">
        <li v-for="row in past" :key="row.key">
          <button
            type="button"
            class="flex w-full items-baseline gap-2 px-3 py-2 text-left hover:bg-slate-800/50"
            :aria-expanded="open === row.key"
            @click="toggle(row.key)"
          >
            <span class="text-[10px] font-bold text-slate-500 uppercase">{{ row.kind }}</span>
            <span class="flex-1 truncate text-slate-200">{{ row.title }}</span>
            <span class="shrink-0 text-xs text-slate-500">{{ timeFrom(row.deadline, now) }}</span>
          </button>
          <div v-if="open === row.key" class="px-3 pb-3">
            <p class="text-xs text-slate-400">{{ row.description }}</p>
            <p class="text-xs text-slate-500">{{ row.subtitle }}</p>
            <p class="mt-1 text-xs font-medium text-emerald-300">{{ row.result }}</p>
            <ul class="mt-2 flex flex-col gap-1">
              <li v-for="bar in row.bars" :key="bar.name" class="flex items-center gap-2 text-xs">
                <span class="w-14 truncate font-medium" :style="{ color: bar.color }">{{
                  bar.name
                }}</span>
                <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    class="h-full rounded-full"
                    :style="{ width: `${(bar.done / bar.needed) * 100}%`, background: bar.color }"
                  />
                </div>
                <span class="w-14 text-right text-slate-400 tabular-nums">
                  {{ bar.note ?? `${bar.done}/${bar.needed}` }}
                </span>
              </li>
            </ul>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
