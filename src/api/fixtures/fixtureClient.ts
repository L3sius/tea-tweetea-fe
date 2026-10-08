import type { StatsGroup } from '@/domain/activity'
import type { ApiClient } from '../client'
import { decode, parseJson } from '../decode'
import { endpoints } from '../endpoints'
import { ApiError } from '../errors'

// Responses recorded from a real server (see `npm run fixtures:refresh`). Loaded as raw text so
// they pass through exactly the same validation as live responses, and lazily so they stay out
// of the main bundle.
const files = import.meta.glob<string>('./data/*.json', { query: '?raw', import: 'default' })

type FixtureName =
  | 'board'
  | 'challenges'
  | 'items'
  | 'state'
  | 'events'
  | 'feed'
  | `stats-by-${StatsGroup}`
  | `me-${string}`

export const FIXTURE_ADMIN_CODE = 'admin'
const JOURNAL_PAGE_LIMIT = 500
const DEFAULT_FEED_LIMIT = 50

export type FixtureClientOptions = {
  /** Simulated network latency, so loading states are visible during development. */
  delayMs?: number
}

/**
 * A read-only API backed by recorded responses, for offline work and tests.
 * Team codes are the team names in lower case, as in the sample game. Commands are checked for a
 * valid code and team version, then accepted without changing anything.
 */
export function createFixtureClient({ delayMs = 0 }: FixtureClientOptions = {}): ApiClient {
  async function load(name: FixtureName): Promise<unknown> {
    const loadFile = files[`./data/${name}.json`]
    if (!loadFile)
      throw new ApiError({ kind: 'server', status: 404, message: `No fixture ${name}` })
    const [text] = await Promise.all([loadFile(), sleep(delayMs)])
    return parseJson(text)
  }

  const getState = async () =>
    decode('fixture:state', endpoints.state.schema, endpoints.state.map, await load('state'))

  async function teamForCode(teamCode: string) {
    const state = await getState()
    const team = [...state.teams.values()].find((t) => t.name.toLowerCase() === teamCode)
    if (!team) throw new ApiError({ kind: 'unauthorized' })
    return { team, seq: state.seq }
  }

  return {
    getBoard: async () =>
      decode('fixture:board', endpoints.board.schema, endpoints.board.map, await load('board')),

    getChallenges: async () =>
      decode(
        'fixture:challenges',
        endpoints.challenges.schema,
        endpoints.challenges.map,
        await load('challenges'),
      ),

    getItems: async () =>
      decode('fixture:items', endpoints.items.schema, endpoints.items.map, await load('items')),

    getState,

    async getJournal({ after = 0, limit = JOURNAL_PAGE_LIMIT } = {}) {
      const { schema, map } = endpoints.journal
      const entries = decode('fixture:events', schema, map, await load('events'))
      return entries
        .filter((entry) => entry.seq > after)
        .slice(0, Math.min(limit, JOURNAL_PAGE_LIMIT))
    },

    async getFeed(query = {}) {
      const items = decode(
        'fixture:feed',
        endpoints.feed.schema,
        endpoints.feed.map,
        await load('feed'),
      )
      return items
        .filter((item) => query.teamId === undefined || item.teamId === query.teamId)
        .filter((item) => query.rsn === undefined || item.rsn === query.rsn)
        .filter((item) => query.kind === undefined || item.kind === query.kind)
        .filter((item) => query.before === undefined || item.id < query.before)
        .slice(0, query.limit ?? DEFAULT_FEED_LIMIT)
    },

    // Only the grouping is honoured; the recordings are unfiltered.
    getStats: async (query) =>
      decode(
        `fixture:stats-by-${query.by}`,
        endpoints.stats.schema,
        endpoints.stats.map,
        await load(`stats-by-${query.by}`),
      ),

    // Only some teams' inventories are recorded; the others hold nothing.
    async getMe(teamCode) {
      const { team, seq } = await teamForCode(teamCode)
      const name = `me-${teamCode}` as const
      if (!files[`./data/${name}.json`])
        return { teamId: team.id, name: team.name, items: new Map(), seq }
      return decode(`fixture:${name}`, endpoints.me.schema, endpoints.me.map, await load(name))
    },

    async sendTeamCommand({ teamCode, version }) {
      const { team, seq } = await teamForCode(teamCode)
      if (version !== team.version) throw new ApiError({ kind: 'stale_version' })
      return { kind: 'accepted', seq }
    },

    async sendAdminCommand({ adminCode }) {
      if (adminCode !== FIXTURE_ADMIN_CODE) throw new ApiError({ kind: 'unauthorized' })
      const state = await getState()
      return { kind: 'accepted', seq: state.seq }
    },

    // Recordings never change, so there is nothing to stream.
    subscribe(_afterSeq, listener) {
      listener({ kind: 'connection', connection: 'offline' })
      return () => {}
    },
  }
}

const sleep = (ms: number) =>
  ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve()
