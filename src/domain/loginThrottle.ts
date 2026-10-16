// Slows down guessing team codes from this browser. It only stops the simplest brute force: the
// server does not limit attempts, and a direct API call skips this entirely.

/** Wrong codes allowed before the first lock. */
export const FREE_TRIES = 5
const FIRST_LOCK_MS = 30_000
const MAX_LOCK_MS = 10 * 60_000

export type LoginThrottle = {
  /** Wrong codes in a row. */
  failures: number
  /** Epoch ms until which no code may be tried, or null. */
  lockedUntil: number | null
}

export const NO_THROTTLE: LoginThrottle = { failures: 0, lockedUntil: null }

/** After the free tries, each wrong code locks the form, twice as long as the last time. */
export function afterFailure(throttle: LoginThrottle, now: number): LoginThrottle {
  const failures = throttle.failures + 1
  const over = failures - FREE_TRIES
  if (over < 0) return { failures, lockedUntil: null }
  const lock = Math.min(MAX_LOCK_MS, FIRST_LOCK_MS * 2 ** over)
  return { failures, lockedUntil: now + lock }
}

/** Milliseconds left on the lock; 0 when a code may be tried. */
export function lockLeft(throttle: LoginThrottle, now: number): number {
  return throttle.lockedUntil === null ? 0 : Math.max(0, throttle.lockedUntil - now)
}

/** Reads a stored throttle, falling back to none for anything malformed. */
export function parseThrottle(text: string | null): LoginThrottle {
  if (!text) return NO_THROTTLE
  try {
    const value: unknown = JSON.parse(text)
    if (typeof value !== 'object' || value === null) return NO_THROTTLE
    const { failures, lockedUntil } = value as Record<string, unknown>
    if (!Number.isInteger(failures) || (failures as number) < 0) return NO_THROTTLE
    if (lockedUntil !== null && typeof lockedUntil !== 'number') return NO_THROTTLE
    return { failures: failures as number, lockedUntil }
  } catch {
    return NO_THROTTLE
  }
}
