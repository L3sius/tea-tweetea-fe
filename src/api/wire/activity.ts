import { z } from 'zod'
import { ClueTier, Id, Timestamp } from './primitives'

const Drop = z.object({ name: z.string(), quantity: z.number(), price_each: z.number() })

export const WireObservation = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('loot'), source: z.string(), items: z.array(Drop) }),
  z.object({
    kind: z.literal('clue'),
    tier: ClueTier,
    items: z.array(Drop),
    region: z.int().nullable(),
  }),
  z.object({ kind: z.literal('kill_count'), boss: z.string(), seconds: z.number().nullable() }),
  z.object({ kind: z.literal('slayer'), task: z.string() }),
  z.object({ kind: z.literal('pet'), name: z.string() }),
  z.object({ kind: z.literal('combat_achievement'), task: z.string() }),
])
export type WireObservation = z.infer<typeof WireObservation>

export const WireFeedItem = z.object({
  id: Id,
  at: Timestamp,
  rsn: z.string(),
  team: Id.nullable(),
  kind: z.enum(['loot', 'clue', 'kill_count', 'slayer', 'pet', 'combat_achievement']),
  subject: z.string(),
  value: z.number(),
  count: z.int().positive(),
  observation: WireObservation,
})
export type WireFeedItem = z.infer<typeof WireFeedItem>

export const WireStatRow = z.object({ key: z.string(), count: z.number(), value: z.number() })
export type WireStatRow = z.infer<typeof WireStatRow>
