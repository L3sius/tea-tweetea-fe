import type { z } from 'zod'
import type { ApiClient } from '../client'
import { decode, parseJson } from '../decode'
import { endpoints } from '../endpoints'
import { ApiError, problemFromStatus } from '../errors'
import { toWireAdminAction, toWireTeamRequest } from '../mappers/commands'
import { WireErrorBody } from '../wire/server'
import { openStream, type EventSourceFactory } from './stream'

type QueryValue = string | number | undefined

export type HttpClientOptions = {
  baseUrl: string
  /** Injectable for tests. */
  fetch?: typeof globalThis.fetch
  /** Injectable for tests. */
  eventSource?: EventSourceFactory
}

export function createHttpClient({
  baseUrl,
  fetch = globalThis.fetch,
  eventSource,
}: HttpClientOptions): ApiClient {
  const root = baseUrl.replace(/\/+$/, '')

  async function send<S extends z.ZodType, D>(
    endpoint: { path: string; schema: S; map: (wire: z.output<S>) => D },
    { query, ...init }: RequestInit & { query?: Record<string, QueryValue> } = {},
  ): Promise<D> {
    const response = await fetchOrThrow(root + endpoint.path + toQueryString(query), init)
    const body = parseJson(await response.text())
    if (!response.ok)
      throw new ApiError(problemFromStatus(response.status, errorMessage(response, body)))
    return decode(endpoint.path, endpoint.schema, endpoint.map, body)
  }

  async function fetchOrThrow(url: string, init: RequestInit): Promise<Response> {
    try {
      // ETags on /board, /challenges and /items are handled by the browser's HTTP cache.
      return await fetch(url, init)
    } catch (error) {
      throw new ApiError({ kind: 'network', message: String(error) })
    }
  }

  const postJson = (headers: Record<string, string>, body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

  return {
    getBoard: () => send(endpoints.board),
    getChallenges: () => send(endpoints.challenges),
    getItems: () => send(endpoints.items),
    getState: () => send(endpoints.state, { cache: 'no-store' }),
    getJournal: (page = {}) =>
      send(endpoints.journal, { query: { after: page.after, limit: page.limit } }),
    getFeed: (query = {}) =>
      send(endpoints.feed, {
        query: {
          team: query.teamId,
          rsn: query.rsn,
          kind: query.kind,
          before: query.before,
          limit: query.limit,
        },
      }),
    getStats: (query) =>
      send(endpoints.stats, {
        query: {
          by: query.by,
          kind: query.kind,
          team: query.teamId,
          rsn: query.rsn,
          subject: query.subject,
          limit: query.limit,
        },
      }),
    identifyTeam: (teamCode) => send(endpoints.me, { headers: { 'X-Team-Code': teamCode } }),
    sendTeamCommand: ({ teamCode, version, command, idempotencyKey }) =>
      send(
        endpoints.teamAction,
        postJson({ 'X-Team-Code': teamCode }, toWireTeamRequest(command, version, idempotencyKey)),
      ),
    sendAdminCommand: ({ adminCode, command }) =>
      send(
        endpoints.adminAction,
        postJson({ 'X-Admin-Code': adminCode }, toWireAdminAction(command)),
      ),
    subscribe: (afterSeq, listener) =>
      openStream(root + '/stream' + toQueryString({ after: afterSeq }), listener, eventSource),
  }
}

function toQueryString(query: Record<string, QueryValue> = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const text = params.toString()
  return text === '' ? '' : `?${text}`
}

function errorMessage(response: Response, body: unknown): string {
  const parsed = WireErrorBody.safeParse(body)
  return parsed.success ? parsed.data.error : response.statusText || `HTTP ${response.status}`
}
