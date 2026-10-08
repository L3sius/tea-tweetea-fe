import { describe, expect, it } from 'vitest'
import { teamId } from '@/domain/ids'
import { ApiError } from '../errors'
import { createFixtureClient } from './fixtureClient'

const client = createFixtureClient()

describe('fixture client', () => {
  it('identifies a team by its sample code', async () => {
    await expect(client.getMe('blue')).resolves.toMatchObject({
      teamId: 1,
      name: 'Gnome Child Gang',
    })
  })

  it('serves the recorded inventory of red, and an empty one for teams without a recording', async () => {
    const red = await client.getMe('red')
    expect(red.items.size).toBeGreaterThan(0)
    expect((await client.getMe('blue')).items.size).toBe(0)
  })

  it('rejects an unknown team code', async () => {
    await expect(client.getMe('purple')).rejects.toBeInstanceOf(ApiError)
  })

  it('accepts a command quoting the current version and rejects a stale one', async () => {
    const state = await client.getState()
    const red = state.teams.get(teamId(0))
    if (!red) throw new Error('fixture has no team 0')
    const request = { teamCode: 'red', command: { kind: 'draw' }, idempotencyKey: 'k' } as const

    await expect(client.sendTeamCommand({ ...request, version: red.version })).resolves.toEqual({
      kind: 'accepted',
      seq: state.seq,
    })
    await expect(
      client.sendTeamCommand({ ...request, version: red.version - 1 }),
    ).rejects.toMatchObject({ problem: { kind: 'stale_version' } })
  })

  it('pages the journal after a sequence number', async () => {
    const page = await client.getJournal({ after: 100, limit: 5 })
    expect(page.map((entry) => entry.seq)).toEqual([101, 102, 103, 104, 105])
  })

  it('filters the feed by team', async () => {
    const feed = await client.getFeed({ teamId: teamId(2), limit: 10 })
    expect(feed.length).toBeGreaterThan(0)
    expect(feed.every((item) => item.teamId === 2)).toBe(true)
  })
})
