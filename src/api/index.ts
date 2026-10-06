import type { AppConfig } from '@/config/env'
import type { ApiClient } from './client'
import { createHttpClient } from './http/httpClient'

/** Builds the client the config asks for. Fixture code is only loaded in fixture mode. */
export async function createApiClient(config: AppConfig['api']): Promise<ApiClient> {
  if (config.mode === 'http') return createHttpClient({ baseUrl: config.baseUrl })
  const { createFixtureClient } = await import('./fixtures/fixtureClient')
  return createFixtureClient({ delayMs: 300 })
}

export type { ApiClient, StreamConnection, StreamMessage } from './client'
export { ApiError, isApiError, describeProblem, type ApiProblem } from './errors'
