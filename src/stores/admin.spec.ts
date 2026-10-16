// @vitest-environment jsdom
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import type { ApiClient } from '@/api'
import { createFixtureClient, FIXTURE_ADMIN_CODE } from '@/api/fixtures/fixtureClient'
import { teamId } from '@/domain/ids'
import { FREE_TRIES } from '@/domain/loginThrottle'
import { useAdminStore } from './admin'
import { apiClientKey } from './apiClient'
import { useGameStore } from './game'

/** The admin store on the recorded game, with the client's admin calls in the test's hands. */
async function adminStore() {
  const fixtures = createFixtureClient()
  const getOverview = vi.fn<ApiClient['getOverview']>(fixtures.getOverview)
  const sendAdminCommand = vi.fn<ApiClient['sendAdminCommand']>(fixtures.sendAdminCommand)
  const client: ApiClient = {
    ...fixtures,
    getOverview,
    sendAdminCommand,
    subscribe: () => () => {},
  }
  const app = createApp({})
  app.provide(apiClientKey, client)
  app.use(createPinia())
  const game = app.runWithContext(() => useGameStore())
  await game.start()
  return { admin: app.runWithContext(() => useAdminStore()), getOverview, sendAdminCommand }
}

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('admin login', () => {
  it('logs in with the admin code and loads the overview', async () => {
    const { admin } = await adminStore()
    await admin.login(FIXTURE_ADMIN_CODE)
    expect(admin.loggedIn).toBe(true)
    expect(admin.overview?.teams.size).toBeGreaterThan(0)
  })

  it('locks after too many wrong codes', async () => {
    const { admin, getOverview } = await adminStore()
    for (let i = 0; i < FREE_TRIES; i++) await admin.login('guess')
    expect(admin.lockedUntil).not.toBeNull()
    await admin.login(FIXTURE_ADMIN_CODE)
    expect(admin.loggedIn).toBe(false)
    expect(getOverview).toHaveBeenCalledTimes(FREE_TRIES)
  })

  it('logs back in for the rest of the tab', async () => {
    const first = await adminStore()
    await first.admin.login(FIXTURE_ADMIN_CODE)
    const again = await adminStore()
    await again.admin.restore()
    expect(again.admin.loggedIn).toBe(true)
  })
})

describe('admin commands', () => {
  it('shows a new code once, with the team it belongs to', async () => {
    const { admin, sendAdminCommand } = await adminStore()
    await admin.login(FIXTURE_ADMIN_CODE)
    sendAdminCommand.mockResolvedValue({
      kind: 'issued',
      seq: 9,
      teamId: teamId(0),
      code: 'abcd-efgh-jkmn-pqrs',
    })
    await admin.run({ kind: 'reset_team_code', teamId: teamId(0) }, 'New code made.')
    expect(admin.issued).toMatchObject({ teamId: 0, code: 'abcd-efgh-jkmn-pqrs' })
    expect(admin.issued?.name).not.toBe('')
  })
})
