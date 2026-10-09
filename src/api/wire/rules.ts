import { z } from 'zod'
import { Timestamp } from './primitives'

/** `GET /rules`: the game-wide numbers the website shows, so it never copies them. */
export const WireRules = z.object({
  start: Timestamp,
  end: Timestamp,
  inventory_limit: z.int(),
  blocker_range: z.int(),
  blocker_lifetime_hours: z.number(),
  blockers_per_team: z.int(),
  shield_hours: z.number(),
  suit_gold_draws: z.int(),
  suit_gold_per_rank: z.number(),
  initiator_multiplier: z.number(),
  random_event_chance: z.number(),
  min_gem_distance: z.int(),
})
export type WireRules = z.infer<typeof WireRules>
