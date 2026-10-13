// @vitest-environment jsdom
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import type { ApiClient } from '@/api'
import type { StreamListener } from '@/api/client'
import { createFixtureClient } from '@/api/fixtures/fixtureClient'
import type { FeedItem } from '@/domain/activity'
import { apiClientKey } from './apiClient'
import { useGameStore } from './game'

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
  const app = createApp({})
  app.provide(apiClientKey, client)
  app.use(createPinia())
  const game = app.runWithContext(() => useGameStore())
  await game.start()
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
