import { describe, expect, it } from 'vitest'
import { QUIET_MS, accountRows, normRsn } from './admin'
import type { Team } from './game'
import { teamId } from './ids'

const NOW = new Date('2026-10-15T12:00:00Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms)

const team = (id: number, members: Team['members']) => ({ id: teamId(id), members }) as Team

describe('normRsn', () => {
  it('ignores case, curly quotes and spacing, like the server', () => {
    expect(normRsn('  Iron  ’Bob  ')).toBe("iron 'bob")
  })
})

describe('accountRows', () => {
  const teams = [
    team(0, [
      { name: 'Zezima', accounts: ['Zezima', 'Zez Alt'] },
      { name: 'Quiet One', accounts: ['Quiet One'] },
    ]),
  ]

  it('flags problems first: unknown, then silent, then quiet', () => {
    const rows = accountRows(
      teams,
      [
        { rsn: 'zezima', teamId: teamId(0), lastSeen: ago(60_000), posts: 4 },
        { rsn: 'Quiet One', teamId: teamId(0), lastSeen: ago(QUIET_MS + 1), posts: 1 },
        { rsn: 'Typo Name', teamId: null, lastSeen: ago(1000), posts: 2 },
      ],
      NOW,
    )
    expect(rows.map((r) => [r.rsn, r.health])).toEqual([
      ['Typo Name', 'unknown'],
      ['Zez Alt', 'silent'],
      ['Quiet One', 'quiet'],
      ['Zezima', 'ok'],
    ])
    expect(rows[3]).toMatchObject({ member: 'Zezima', posts: 4 })
  })

  it('adds up spelling variants of one account', () => {
    const rows = accountRows(
      teams,
      [
        { rsn: 'Zezima', teamId: teamId(0), lastSeen: ago(5000), posts: 2 },
        { rsn: 'ZEZIMA', teamId: teamId(0), lastSeen: ago(1000), posts: 3 },
      ],
      NOW,
    )
    expect(rows.find((r) => r.rsn === 'Zezima')).toMatchObject({ posts: 5, lastSeen: ago(1000) })
  })
})
