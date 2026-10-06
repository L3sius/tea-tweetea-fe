import { describe, expect, it, vi } from 'vitest'
import { teamId } from '@/domain/ids'
import { ApiError, type ApiProblem } from '../errors'
import { createHttpClient } from './httpClient'

const BASE_URL = 'http://api.test/'

function clientReturning(status: number, body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(text, { status }))
  return { client: createHttpClient({ baseUrl: BASE_URL, fetch }), fetch }
}

async function problemOf(promise: Promise<unknown>): Promise<ApiProblem> {
  const error: unknown = await promise.catch((e: unknown) => e)
  if (!(error instanceof ApiError)) throw new Error(`Expected an ApiError, got ${String(error)}`)
  return error.problem
}

const command = {
  teamCode: 'red',
  version: 3,
  command: { kind: 'draw' },
  idempotencyKey: 'k',
} as const

describe('requests', () => {
  it('sends the team code and the wire-format body', async () => {
    const { client, fetch } = clientReturning(200, { seq: 960 })

    await expect(client.sendTeamCommand(command)).resolves.toEqual({ kind: 'accepted', seq: 960 })

    const [url, init] = fetch.mock.calls[0] ?? []
    expect(url).toBe('http://api.test/team/action')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('X-Team-Code')).toBe('red')
    expect(JSON.parse(String(init?.body))).toEqual({ version: 3, key: 'k', action: 'draw' })
  })

  it('builds the query string from defined filters only', async () => {
    const { client, fetch } = clientReturning(200, [])

    await client.getFeed({ teamId: teamId(2), limit: 20 })

    expect(fetch.mock.calls[0]?.[0]).toBe('http://api.test/feed?team=2&limit=20')
  })

  it('tells a revert apart from an accepted command', async () => {
    const { client } = clientReturning(200, { dropped: [12, 13] })
    const reply = await client.sendAdminCommand({
      adminCode: 'admin',
      command: { kind: 'revert', seq: 12 },
    })
    expect(reply).toEqual({ kind: 'reverted', droppedSeqs: [12, 13] })
  })
})

describe('failures', () => {
  it.each<[number, ApiProblem]>([
    [401, { kind: 'unauthorized' }],
    [409, { kind: 'stale_version' }],
    [422, { kind: 'rule_violation', message: 'not ready to draw' }],
    [500, { kind: 'server', status: 500, message: 'not ready to draw' }],
  ])('maps status %i to a problem', async (status, expected) => {
    const { client } = clientReturning(status, { error: 'not ready to draw' })
    expect(await problemOf(client.sendTeamCommand(command))).toEqual(expected)
  })

  it('falls back to the status text when the error body is not JSON', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response('<html>', { status: 502, statusText: 'Bad Gateway' }),
    )
    const client = createHttpClient({ baseUrl: BASE_URL, fetch })
    expect(await problemOf(client.getState())).toEqual({
      kind: 'server',
      status: 502,
      message: 'Bad Gateway',
    })
  })

  it('reports a network failure', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError('Failed to fetch')
    })
    const client = createHttpClient({ baseUrl: BASE_URL, fetch })
    expect(await problemOf(client.getBoard())).toMatchObject({ kind: 'network' })
  })

  it('rejects a response that breaks the contract', async () => {
    const { client } = clientReturning(200, { team: 'red' })
    expect(await problemOf(client.identifyTeam('red'))).toMatchObject({
      kind: 'invalid_response',
      endpoint: '/team/me',
    })
  })
})
