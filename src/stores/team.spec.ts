// @vitest-environment jsdom
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import type { ApiClient } from '@/api'
import { ApiError } from '@/api'
import { createFixtureClient } from '@/api/fixtures/fixtureClient'
import { teamId } from '@/domain/ids'
import { FREE_TRIES } from '@/domain/loginThrottle'
import { apiClientKey } from './apiClient'
import { useTeamStore } from './team'

/** The team store with `getMe` accepting only the code "red". */
function teamStore() {
  const getMe = vi.fn<ApiClient['getMe']>(async (code) => {
    if (code !== 'red') throw new ApiError({ kind: 'unauthorized' })
    return { teamId: teamId(0), name: 'Red', items: new Map(), seq: 1 }
  })
  const app = createApp({})
  app.provide(apiClientKey, { ...createFixtureClient(), getMe })
  app.use(createPinia())
  return { team: app.runWithContext(() => useTeamStore()), getMe }
}

afterEach(() => localStorage.clear())

describe('login throttle', () => {
  it('stops asking the server after too many wrong codes', async () => {
    const { team, getMe } = teamStore()
    for (let i = 0; i < FREE_TRIES; i++) await team.login('guess')
    expect(team.loginLockedUntil).not.toBeNull()

    await team.login('red')
    expect(getMe).toHaveBeenCalledTimes(FREE_TRIES)
    expect(team.teamId).toBeNull()
  })

  it('keeps the lock after a reload', async () => {
    const first = teamStore()
    for (let i = 0; i < FREE_TRIES; i++) await first.team.login('guess')

    expect(teamStore().team.loginLockedUntil).toBe(first.team.loginLockedUntil)
  })

  it('forgets earlier wrong codes once a code works', async () => {
    const { team } = teamStore()
    for (let i = 0; i < FREE_TRIES - 1; i++) await team.login('guess')
    await team.login('red')
    team.logout()

    await team.login('guess')
    expect(team.loginLockedUntil).toBeNull()
  })

  it('does not count a network failure as a wrong code', async () => {
    const { team, getMe } = teamStore()
    getMe.mockRejectedValue(new ApiError({ kind: 'network', message: 'offline' }))
    for (let i = 0; i < FREE_TRIES; i++) await team.login('red')
    expect(team.loginLockedUntil).toBeNull()
  })

  it('logs back in with a saved code while locked', async () => {
    const { team } = teamStore()
    for (let i = 0; i < FREE_TRIES; i++) await team.login('guess')
    localStorage.setItem('tweetea.teamCode', 'red')

    await team.restore()
    expect(team.teamId).toBe(0)
  })
})
