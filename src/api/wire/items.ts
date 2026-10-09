import { z } from 'zod'

export const WireItemInfo = z.object({
  name: z.string(),
  description: z.string(),
  /** Image URL, typically from the OSRS Wiki. */
  icon: z.string().nullable(),
  /** Gold, at any shop that stocks it. */
  price: z.number(),
})

/**
 * `GET /items`: item id to its catalogue entry, keyed loosely so an item the frontend does not
 * know yet is skipped rather than failing the whole catalogue. The mystery box is sold in every
 * shop but is not an item: buying it puts a random item straight into the inventory.
 */
export const WireItems = z.object({
  items: z.record(z.string(), WireItemInfo),
  mystery_box: WireItemInfo,
})
export type WireItems = z.infer<typeof WireItems>
