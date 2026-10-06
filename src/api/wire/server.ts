import { z } from 'zod'
import { Id, Timestamp } from './primitives'

export const WireHello = z.object({ server_time: Timestamp, build: z.string(), seq: z.int() })
export type WireHello = z.infer<typeof WireHello>

/** `GET /team/me`. */
export const WireMe = z.object({ team: Id, name: z.string() })
export type WireMe = z.infer<typeof WireMe>

export const WireAccepted = z.object({ seq: z.int().nonnegative() })
export const WireReverted = z.object({ dropped: z.array(z.int()) })
export const WireAdminReply = z.union([WireAccepted, WireReverted])
export type WireAdminReply = z.infer<typeof WireAdminReply>

/** The body of every non-2xx response. */
export const WireErrorBody = z.object({ error: z.string() })
