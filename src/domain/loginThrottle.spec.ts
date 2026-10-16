import { describe, expect, it } from 'vitest'
import { FREE_TRIES, NO_THROTTLE, afterFailure, lockLeft, parseThrottle } from './loginThrottle'

const failTimes = (n: number, now = 0) => {
  let throttle = NO_THROTTLE
  for (let i = 0; i < n; i++) throttle = afterFailure(throttle, now)
  return throttle
}

describe('afterFailure', () => {
  it('allows the free tries without a lock', () => {
    expect(failTimes(FREE_TRIES - 1)).toEqual({ failures: FREE_TRIES - 1, lockedUntil: null })
  })

  it('locks for 30 seconds on the last free try, then doubles', () => {
    expect(lockLeft(failTimes(FREE_TRIES), 0)).toBe(30_000)
    expect(lockLeft(failTimes(FREE_TRIES + 1), 0)).toBe(60_000)
    expect(lockLeft(failTimes(FREE_TRIES + 2), 0)).toBe(120_000)
  })

  it('never locks for more than ten minutes', () => {
    expect(lockLeft(failTimes(FREE_TRIES + 20), 0)).toBe(10 * 60_000)
  })
})

describe('lockLeft', () => {
  it('counts down and stops at zero', () => {
    const throttle = failTimes(FREE_TRIES, 1_000)
    expect(lockLeft(throttle, 11_000)).toBe(20_000)
    expect(lockLeft(throttle, 99_000)).toBe(0)
  })
})

describe('parseThrottle', () => {
  it('reads back what was stored', () => {
    const throttle = failTimes(FREE_TRIES + 1, 5)
    expect(parseThrottle(JSON.stringify(throttle))).toEqual(throttle)
  })

  it.each([null, '', 'not json', '42', '{"failures":-1,"lockedUntil":null}', '{"failures":2}'])(
    'treats %j as no throttle',
    (text) => expect(parseThrottle(text)).toEqual(NO_THROTTLE),
  )
})
