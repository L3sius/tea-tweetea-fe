// Minigames as the panel shows them: what is at stake, and each team's standing in order, leader
// first.
import type { Challenge } from './challenge'
import { challengeProgress, type Names } from './describe'
import type { GameState, Minigame } from './game'
import type { ChallengeId, InstanceId, TeamId } from './ids'

/** What a contest pays: gold by finishing place, or gold per unit up to a cap. */
export type Stake =
  { kind: 'places'; payouts: number[] } | { kind: 'per_unit'; goldPerUnit: number; cap: number }

export type Standing = {
  teamId: TeamId
  done: number
  needed: number
  /** The team finished the task. */
  finished: boolean
  /** Its place among the teams that finished a race, from 1. */
  place: number | null
  /** Gold it was paid, once the contest closed. */
  gold: number | null
}

export type Contest = {
  key: string
  title: string
  description: string
  deadline: Date
  stake: Stake
  /** The team that opened a minigame, which earns double. */
  initiator: TeamId | null
  /** Leader first. */
  standings: Standing[]
  /** How it ended, once it did. */
  result: string | null
  live: boolean
}

type Context = {
  state: GameState
  challenges: ReadonlyMap<ChallengeId, Challenge>
  names: Names
}

/** Every team's progress on an instance, in team order. */
function progressOf(c: Context, instanceId: InstanceId) {
  const instance = c.state.instances.get(instanceId)
  const challenge = (instance && c.challenges.get(instance.challengeId)) ?? null
  const rows = [...c.state.teams.values()].map((team) => {
    const p = challenge ? challengeProgress(challenge, instance, team.id) : { done: 0, needed: 1 }
    return {
      teamId: team.id,
      done: p.done,
      needed: p.needed,
      finished: !!instance?.done.has(team.id),
    }
  })
  return { challenge, rows }
}

/** Placed teams by place, then the rest by how far along they are, then in team order. */
export function byStanding(a: Standing, b: Standing): number {
  if (a.place !== null || b.place !== null) return (a.place ?? Infinity) - (b.place ?? Infinity)
  return b.done / b.needed - a.done / a.needed || a.teamId - b.teamId
}

export function minigameContest(c: Context, m: Minigame): Contest {
  const { challenge, rows } = progressOf(c, m.instanceId)
  const paid = new Map((m.payouts ?? []).map((p) => [p.teamId, p.gold]))
  const stake: Stake =
    m.scoring.kind === 'race'
      ? { kind: 'places', payouts: m.scoring.payouts }
      : { kind: 'per_unit', goldPerUnit: m.scoring.goldPerUnit, cap: m.scoring.cap }
  const standings = rows.map((r): Standing => {
    const place = m.finished.indexOf(r.teamId)
    return {
      ...r,
      // Contribution minigames count up to the cap, not to the task's own target.
      ...(stake.kind === 'per_unit'
        ? { done: Math.min(r.done, stake.cap), needed: stake.cap }
        : {}),
      place: stake.kind === 'places' && place >= 0 ? place + 1 : null,
      gold: m.payouts ? (paid.get(r.teamId) ?? 0) : null,
    }
  })
  return {
    key: `minigame-${m.id}`,
    title: challenge?.name ?? 'Unknown challenge',
    description: challenge?.description ?? '',
    deadline: m.deadline,
    stake,
    initiator: m.initiator,
    standings: standings.sort(byStanding),
    result: m.payouts && m.payouts.length === 0 ? 'Nobody scored' : null,
    live: m.payouts === null,
  }
}

/** Live minigames, and finished ones, latest first. */
export function contests(c: Context): { live: Contest[]; past: Contest[] } {
  const all = [...c.state.minigames.values()].map((m) => minigameContest(c, m))
  return {
    live: all.filter((x) => x.live),
    past: all.filter((x) => !x.live).sort((a, b) => b.deadline.getTime() - a.deadline.getTime()),
  }
}

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st. */
export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

/**
 * A team's standing in a few words: "Not yet" while a one-off task is open ("Didn't finish" once
 * the contest is over), its count while it is under way, "1st ✓" once it placed in a race, and
 * the gold once paid.
 */
export function standingText(s: Standing, stake: Stake, live = true): string {
  const paid = s.gold !== null && s.gold > 0 ? ` +${s.gold} gold` : ''
  if (s.place !== null) return `${ordinal(s.place)} ✓${paid}`
  if (s.finished && stake.kind !== 'per_unit') return `Done ✓${paid}`
  const count =
    s.needed === 1 && s.done === 0
      ? live
        ? 'Not yet'
        : "Didn't finish"
      : `${s.done}/${s.needed}${s.finished || s.done >= s.needed ? ' ✓' : ''}`
  return `${count}${paid}`
}

/** Time left before `deadline`, as "4h 59m", "12m" or "Ending…". */
export function timeLeft(deadline: Date, now: Date): string {
  const minutes = Math.floor((deadline.getTime() - now.getTime()) / 60_000)
  if (minutes < 1) return 'Ending…'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const rest = minutes % 60
  if (days > 0) return `${days}d ${hours}h`
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`
}
