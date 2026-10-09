import type { Rules } from '@/domain/rules'
import type { WireRules } from '../wire/rules'
import { toDate } from './shared'

export const toRules = (wire: WireRules): Rules => ({
  start: toDate(wire.start),
  end: toDate(wire.end),
  inventoryLimit: wire.inventory_limit,
  blockerRange: wire.blocker_range,
  blockerLifetimeHours: wire.blocker_lifetime_hours,
  blockersPerTeam: wire.blockers_per_team,
  shieldHours: wire.shield_hours,
  suitGoldDraws: wire.suit_gold_draws,
  suitGoldPerRank: wire.suit_gold_per_rank,
  initiatorMultiplier: wire.initiator_multiplier,
  randomEventChance: wire.random_event_chance,
  minGemDistance: wire.min_gem_distance,
})
