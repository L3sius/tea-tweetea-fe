import { z } from 'zod'
import { CaTier, ClueTier } from './primitives'

const Sources = z.union([z.literal('any'), z.array(z.string())])

const LootFilter = z.discriminatedUnion('by', [
  z.object({
    by: z.literal('items'),
    items: z.array(
      z.object({ name: z.string(), aliases: z.array(z.string()).optional(), sources: Sources }),
    ),
  }),
  z.object({
    by: z.literal('value'),
    min_gp: z.number(),
    per: z.enum(['stack', 'drop']),
    sources: Sources,
  }),
])

const ClueFilter = z.discriminatedUnion('by', [
  z.object({ by: z.literal('count') }),
  z.object({ by: z.literal('value'), min_gp: z.number(), max_gp: z.number().nullish() }),
  z.object({ by: z.literal('region'), region_ids: z.array(z.int()) }),
  z.object({ by: z.literal('items'), items: z.array(z.string()) }),
  z.object({ by: z.literal('exact_stack'), item: z.string(), quantity: z.int() }),
])

const Criterion = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('loot'), filter: LootFilter }),
  z.object({ kind: z.literal('clue'), tier: ClueTier, filter: ClueFilter }),
  z.object({ kind: z.literal('kill_count'), bosses: z.array(z.string()) }),
  z.object({ kind: z.literal('timed_kill'), boss: z.string(), max_seconds: z.number() }),
  z.object({ kind: z.literal('slayer'), tasks: z.array(z.string()) }),
  z.object({ kind: z.literal('pet'), pets: z.array(z.string()) }),
  z.object({
    kind: z.literal('combat_achievement'),
    tasks: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        tier: CaTier,
        monster: z.string().nullish(),
      }),
    ),
  }),
])

const Effort = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('kills'), bosses: z.array(z.string()) }),
  z.object({ kind: z.literal('loots'), sources: Sources }),
  z.object({ kind: z.literal('caskets'), tier: ClueTier }),
  z.object({ kind: z.literal('best_time'), boss: z.string() }),
  z.object({ kind: z.literal('elapsed') }),
])

const Goal = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('total'), n: z.int().positive() }),
  z.object({ kind: z.literal('each'), n: z.int().positive() }),
])

export const WireChallenge = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string(),
  est_hours: z.number(),
  tags: z.array(z.string()).optional(),
  criterion: Criterion,
  goal: Goal,
  /** `/challenges` always fills it in. */
  effort: Effort.nullish(),
})
export type WireChallenge = z.infer<typeof WireChallenge>

/** `GET /challenges`: challenge id to challenge. */
export const WireChallenges = z.record(z.string(), WireChallenge)
export type WireChallenges = z.infer<typeof WireChallenges>
