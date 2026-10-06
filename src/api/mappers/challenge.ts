import type { Challenge, ClueFilter, Criterion, LootFilter, Sources } from '@/domain/challenge'
import { challengeId, type ChallengeId } from '@/domain/ids'
import type { WireChallenge, WireChallenges } from '../wire/challenge'

type WireCriterion = WireChallenge['criterion']
type WireLootFilter = Extract<WireCriterion, { kind: 'loot' }>['filter']
type WireClueFilter = Extract<WireCriterion, { kind: 'clue' }>['filter']
type WireSources = 'any' | string[]

const toSources = (wire: WireSources): Sources =>
  wire === 'any' ? { kind: 'any' } : { kind: 'listed', names: wire }

function toLootFilter(wire: WireLootFilter): LootFilter {
  if (wire.by === 'value') {
    return { kind: 'value', minGp: wire.min_gp, per: wire.per, sources: toSources(wire.sources) }
  }
  return {
    kind: 'items',
    items: wire.items.map((item) => ({
      name: item.name,
      aliases: item.aliases ?? [],
      sources: toSources(item.sources),
    })),
  }
}

function toClueFilter(wire: WireClueFilter): ClueFilter {
  switch (wire.by) {
    case 'count':
      return { kind: 'count' }
    case 'value':
      return { kind: 'value', minGp: wire.min_gp, maxGp: wire.max_gp ?? null }
    case 'region':
      return { kind: 'region', regionIds: wire.region_ids }
    case 'items':
      return { kind: 'items', items: wire.items }
    case 'exact_stack':
      return { kind: 'exact_stack', item: wire.item, quantity: wire.quantity }
  }
}

function toCriterion(wire: WireCriterion): Criterion {
  switch (wire.kind) {
    case 'loot':
      return { kind: 'loot', filter: toLootFilter(wire.filter) }
    case 'clue':
      return { kind: 'clue', tier: wire.tier, filter: toClueFilter(wire.filter) }
    case 'timed_kill':
      return { kind: 'timed_kill', boss: wire.boss, maxSeconds: wire.max_seconds }
    case 'kill_count':
    case 'slayer':
    case 'pet':
    case 'combat_achievement':
      return wire
  }
}

export function toChallenge(wire: WireChallenge): Challenge {
  return {
    id: challengeId(wire.id),
    name: wire.name,
    description: wire.description,
    estHours: wire.est_hours,
    tags: wire.tags ?? [],
    criterion: toCriterion(wire.criterion),
    goal: wire.goal,
  }
}

export function toChallenges(wire: WireChallenges): Map<ChallengeId, Challenge> {
  return new Map(Object.values(wire).map((c) => [challengeId(c.id), toChallenge(c)]))
}
