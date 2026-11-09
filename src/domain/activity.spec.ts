import { describe, expect, it } from 'vitest'
import { statSubject, statTeam, statsByRsn } from './activity'

describe('stats row keys', () => {
  it('reads a team id, and "none" as no team', () => {
    expect(statTeam('3')).toBe(3)
    expect(statTeam('0')).toBe(0)
    expect(statTeam('none')).toBeNull()
  })

  it('names an event with no source', () => {
    expect(statSubject('')).toBe('Unknown source')
    expect(statSubject('Vorkath')).toBe('Vorkath')
  })
})

describe('statsByRsn', () => {
  it('adds up spelling variants of one account under its normal name', () => {
    const rows = statsByRsn([
      { key: 'Zezima', count: 2, value: 100 },
      { key: 'ZEZIMA ', count: 3, value: 50 },
      { key: 'Iron  ’Bob', count: 1, value: 0 },
    ])
    expect(rows.get('zezima')).toEqual({ key: 'zezima', count: 5, value: 150 })
    expect(rows.get("iron 'bob")).toMatchObject({ count: 1 })
    expect(rows.size).toBe(2)
  })
})
