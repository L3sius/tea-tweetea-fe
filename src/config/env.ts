import { z } from 'zod'

/** Where tools/characters uploads the OSRS character assets. */
const OSRS_ASSETS_URL = 'https://api.tea-osrs.com/osrs/'

const Env = z
  .object({
    VITE_API_MODE: z.enum(['http', 'fixtures']).default('http'),
    VITE_API_BASE_URL: z.url().optional(),
    VITE_OSRS_ASSETS_URL: z.url().default(OSRS_ASSETS_URL),
  })
  .refine((env) => env.VITE_API_MODE === 'fixtures' || env.VITE_API_BASE_URL !== undefined, {
    message: 'VITE_API_BASE_URL is required when VITE_API_MODE is "http"',
    path: ['VITE_API_BASE_URL'],
  })

export type AppConfig = {
  api: { mode: 'fixtures' } | { mode: 'http'; baseUrl: string }
  /** Where the OSRS character assets (tools/characters) are served from. */
  osrsAssetsUrl: string
}

/** Reads public build-time config. Fails fast so a misconfigured build never half-works. */
export function readConfig(env: Record<string, unknown> = import.meta.env): AppConfig {
  const parsed = Env.safeParse(env)
  if (!parsed.success) throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`)
  const { VITE_API_MODE: mode, VITE_API_BASE_URL: baseUrl, VITE_OSRS_ASSETS_URL } = parsed.data
  return {
    api: mode === 'http' && baseUrl ? { mode, baseUrl } : { mode: 'fixtures' },
    osrsAssetsUrl: VITE_OSRS_ASSETS_URL,
  }
}
