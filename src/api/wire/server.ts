import { z } from 'zod'
import { Id, Item, Timestamp } from './primitives'

export const WireHello = z.object({ server_time: Timestamp, build: z.string(), seq: z.int() })
export type WireHello = z.infer<typeof WireHello>

/** `GET /team/me`: the caller's team, with its private inventory. */
export const WireMe = z.object({
  team: Id,
  name: z.string(),
  items: z.partialRecord(Item, z.int().nonnegative()),
  seq: z.int().nonnegative(),
})
export type WireMe = z.infer<typeof WireMe>

export const WireAccepted = z.object({ seq: z.int().nonnegative() })
export const WireReverted = z.object({ dropped: z.array(z.int()) })
export const WireCodeIssued = z.object({ seq: z.int().nonnegative(), team: Id, code: z.string() })
// The issued shape first: it also carries `seq`, so the accepted one would match it too.
export const WireAdminReply = z.union([WireCodeIssued, WireAccepted, WireReverted])
export type WireAdminReply = z.infer<typeof WireAdminReply>

/** `GET /admin/overview`: what only admins see. */
export const WireOverview = z.object({
  seq: z.int().nonnegative(),
  teams: z.array(
    z.object({
      team: Id,
      items: z.partialRecord(Item, z.int().nonnegative()),
      code_issued: z.boolean(),
    }),
  ),
  accounts: z.array(
    z.object({
      rsn: z.string(),
      team: Id.nullable(),
      last_seen: Timestamp,
      posts: z.int().nonnegative(),
    }),
  ),
})
export type WireOverview = z.infer<typeof WireOverview>

/** The body of every non-2xx response. */
export const WireErrorBody = z.object({ error: z.string() })
