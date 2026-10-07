import { z } from 'zod'

export const WireItemInfo = z.object({
  name: z.string(),
  description: z.string(),
  /** Image URL, typically from the OSRS Wiki. */
  icon: z.string().nullable(),
})

/**
 * `GET /items`: item id to its catalogue entry. Keyed loosely so an item the frontend does not
 * know yet is skipped rather than failing the whole catalogue.
 */
export const WireItems = z.record(z.string(), WireItemInfo)
export type WireItems = z.infer<typeof WireItems>
