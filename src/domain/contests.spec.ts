import { describe, expect, it } from 'vitest'
import { byStanding, ordinal, standingText, timeLeft, type Stake, type Standing } from './contests'
import { teamId } from './ids'

const standing = (over: Partial<Standing> = {}): Standing => ({
  teamId: teamId(0),
  done: 0,
  needed: 1,
  finished: false,
  place: null,
  gold: null,
  ...over,
})
const race: Stake = { kind: 'places', payouts: [20, 10, 5, 3] }
const perUnit: Stake = { kind: 'per_unit', goldPerUnit: 1, cap: 50 }

describe('standingText', () => {
  it(`says "Not yet" for a one-off task nobody has done, and "Didn't finish" once it is over`, () => {
    expect(standingText(standing(), race)).toBe('Not yet')
    expect(standingText(standing(), race, false)).toBe("Didn't finish")
  })

  it('counts a longer task, and ticks it once it is complete', () => {
    expect(standingText(standing({ done: 12, needed: 50 }), perUnit)).toBe('12/50')
    expect(standingText(standing({ done: 50, needed: 50 }), perUnit)).toBe('50/50 ✓')
  })

  it('shows a race place, and the gold once paid', () => {
    expect(standingText(standing({ done: 1, finished: true, place: 1 }), race)).toBe('1st ✓')
    expect(standingText(standing({ done: 1, finished: true, place: 2, gold: 10 }), race)).toBe(
      '2nd ✓ +10 gold',
    )
    expect(standingText(standing({ done: 30, needed: 50, gold: 30 }), perUnit)).toBe(
      '30/50 +30 gold',
    )
  })
})

describe('byStanding', () => {
  it('puts placed teams first by place, then the rest by progress, then team order', () => {
    const rows = [
      standing({ teamId: teamId(0), done: 1, needed: 4 }),
      standing({ teamId: teamId(1), place: 2, done: 4, needed: 4 }),
      standing({ teamId: teamId(2), done: 3, needed: 4 }),
      standing({ teamId: teamId(3), place: 1, done: 4, needed: 4 }),
      standing({ teamId: teamId(4), done: 1, needed: 4 }),
    ]
    expect(rows.sort(byStanding).map((r) => r.teamId)).toEqual([3, 1, 2, 0, 4])
  })
})

describe('ordinal', () => {
  it('uses English suffixes', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '101st',
    ])
  })
})

describe('timeLeft', () => {
  const now = new Date('2026-10-08T12:00:00Z')
  const inMinutes = (m: number) => new Date(now.getTime() + m * 60_000)
  it('shows days, hours and minutes as they apply', () => {
    expect(timeLeft(inMinutes(299), now)).toBe('4h 59m')
    expect(timeLeft(inMinutes(12), now)).toBe('12m')
    expect(timeLeft(inMinutes(60 * 30), now)).toBe('1d 6h')
    expect(timeLeft(inMinutes(0), now)).toBe('Ending…')
  })
})
