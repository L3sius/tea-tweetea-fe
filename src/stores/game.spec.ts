// @vitest-environment jsdom
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import type { ApiClient } from '@/api'
import type { StreamListener } from '@/api/client'
import { createFixtureClient } from '@/api/fixtures/fixtureClient'
import type { FeedItem } from '@/domain/activity'
import type { JournalEntry } from '@/domain/events'
import { instanceId, teamId, tileId } from '@/domain/ids'
import { apiClientKey } from './apiClient'
import { useGameStore } from './game'

/** A started game store on `client`. */
async function gameOn(client: ApiClient) {
  const app = createApp({})
  app.provide(apiClientKey, client)
  app.use(createPinia())
  const game = app.runWithContext(() => useGameStore())
  await game.start()
  return game
}

/** The game store on the recorded game, with the stream in the test's hands. */
async function startedGame() {
  const fixtures = createFixtureClient()
  let send: StreamListener = () => {}
  const getFeed = vi.fn<ApiClient['getFeed']>(fixtures.getFeed)
  const client: ApiClient = {
    ...fixtures,
    getFeed,
    subscribe: (_after, listener) => {
      send = listener
      return () => {}
    },
  }
  const game = await gameOn(client)
  getFeed.mockClear()
  return { game, getFeed, send: (message: Parameters<StreamListener>[0]) => send(message) }
}

const drop = (kind: 'loot' | 'death'): FeedItem => ({
  id: 1,
  at: new Date(),
  rsn: 'Zezima',
  teamId: null,
  kind,
  subject: 'Vorkath',
  value: 0,
  count: 1,
  observation:
    kind === 'death'
      ? { kind: 'death', killer: 'Vorkath', pvp: false }
      : { kind: 'loot', source: 'Vorkath', items: [] },
})

/** Past the store's refresh debounce. */
const settle = () => vi.advanceTimersByTimeAsync(1_000)

afterEach(() => vi.useRealTimers())

describe('the activity feed', () => {
  it('is not refetched for a drop while no view shows it, until one opens', async () => {
    const { game, getFeed, send } = await startedGame()
    vi.useFakeTimers()

    send({ kind: 'feed', item: drop('loot') })
    send({ kind: 'feed', item: drop('loot') })
    await settle()
    expect(getFeed).not.toHaveBeenCalled()

    const unwatch = game.watchFeed()
    await settle()
    expect(getFeed).toHaveBeenCalledTimes(1)
    unwatch()
  })

  it('is refetched for each drop while a view shows it, and not after it closes', async () => {
    const { game, getFeed, send } = await startedGame()
    vi.useFakeTimers()

    const unwatch = game.watchFeed()
    await settle()
    expect(getFeed).not.toHaveBeenCalled()
    send({ kind: 'feed', item: drop('loot') })
    await settle()
    expect(getFeed).toHaveBeenCalledTimes(1)

    unwatch()
    unwatch()
    send({ kind: 'feed', item: drop('loot') })
    await settle()
    expect(getFeed).toHaveBeenCalledTimes(1)
  })

  it('is refetched at once for a death, which the board taunts', async () => {
    const { getFeed, send } = await startedGame()
    vi.useFakeTimers()

    send({ kind: 'feed', item: drop('death') })
    await settle()
    expect(getFeed).toHaveBeenCalledTimes(1)
  })
})

describe('the game log', () => {
  it('pages back past task progress to the moves it shows, and leaves the progress out', async () => {
    const fixtures = createFixtureClient()
    const SEQ = 1200
    const at = new Date(0)
    const progress = (seq: number): JournalEntry => ({
      seq,
      at,
      events: [
        {
          kind: 'progress',
          instanceId: instanceId(1),
          teamId: teamId(0),
          key: 'Royal Titans',
          amount: 1,
          progress: { counts: new Map(), done: 1, target: 315, effort: 1 },
        },
      ],
    })
    const journal = Array.from({ length: SEQ }, (_, i): JournalEntry =>
      i + 1 === 100
        ? { seq: 100, at, events: [{ kind: 'stepped', teamId: teamId(0), tileId: tileId(3) }] }
        : progress(i + 1),
    )
    const getJournal = vi.fn<ApiClient['getJournal']>(async ({ after = 0, limit = 500 } = {}) =>
      journal.filter((e) => e.seq > after).slice(0, Math.min(limit, 500)),
    )
    const client: ApiClient = {
      ...fixtures,
      getState: async () => ({ ...(await fixtures.getState()), seq: SEQ }),
      getJournal,
      subscribe: () => () => {},
    }
    const game = await gameOn(client)

    expect(game.log.map((e) => e.seq)).toEqual([100])
    expect(getJournal).toHaveBeenCalledTimes(3)
  })
})
