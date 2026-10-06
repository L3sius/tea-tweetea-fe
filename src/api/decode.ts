import { z } from 'zod'
import { ApiError } from './errors'

/** Validates an untrusted body against its wire schema, then maps it into the domain. */
export function decode<S extends z.ZodType, D>(
  endpoint: string,
  schema: S,
  map: (wire: z.output<S>) => D,
  body: unknown,
): D {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError({
      kind: 'invalid_response',
      endpoint,
      details: z.prettifyError(parsed.error),
    })
  }
  return map(parsed.data)
}

/** Parses JSON text without throwing; `undefined` means the text was not JSON. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}
