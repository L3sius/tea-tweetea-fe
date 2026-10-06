import { inject, type InjectionKey } from 'vue'
import type { ApiClient } from '@/api'

export const apiClientKey: InjectionKey<ApiClient> = Symbol('ApiClient')

/** The client `main.ts` provided. Only stores call this. */
export function useApiClient(): ApiClient {
  const client = inject(apiClientKey)
  if (!client) throw new Error('No ApiClient provided; see main.ts')
  return client
}
