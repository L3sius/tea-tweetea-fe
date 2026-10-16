// What the admin page works out from the state and the admin overview.
import type { Team } from './game'
import type { TeamId } from './ids'
import type { DinkAccount } from './server'

/** Dink has not posted for an account for this long: its plugin may be off or misconfigured. */
export const QUIET_MS = 6 * 60 * 60 * 1000

/** RuneScape names as the server compares them: case, curly quotes and spacing do not count. */
export function normRsn(name: string): string {
  return name.replace(/[‘’]/g, "'").toLowerCase().split(/\s+/).filter(Boolean).join(' ')
}

export type AccountHealth =
  /** Dink posts for it, but it is on no roster: a typo, a name change or someone not signed up. */
  | 'unknown'
  /** On a roster, but Dink has never posted for it. */
  | 'silent'
  /** On a roster, but nothing for a while. */
  | 'quiet'
  | 'ok'

export type AccountRow = {
  rsn: string
  teamId: TeamId | null
  /** The roster member the account belongs to. */
  member: string | null
  lastSeen: Date | null
  posts: number
  health: AccountHealth
}

const ORDER: Record<AccountHealth, number> = { unknown: 0, silent: 1, quiet: 2, ok: 3 }

/**
 * Every account worth a look: each one on a roster, with or without Dink posts, and each one Dink
 * posted for that is on no roster. Problems come first, then the longest quiet.
 */
export function accountRows(teams: Iterable<Team>, dink: DinkAccount[], now: Date): AccountRow[] {
  const seen = new Map<string, DinkAccount>()
  for (const a of dink) {
    const key = normRsn(a.rsn)
    const known = seen.get(key)
    // The server groups exact names; spelling variants of one account add up.
    seen.set(
      key,
      known
        ? {
            ...known,
            posts: known.posts + a.posts,
            lastSeen: known.lastSeen > a.lastSeen ? known.lastSeen : a.lastSeen,
          }
        : a,
    )
  }
  const rows: AccountRow[] = []
  const rostered = new Set<string>()
  for (const team of teams) {
    for (const member of team.members) {
      for (const rsn of member.accounts) {
        const key = normRsn(rsn)
        rostered.add(key)
        const posted = seen.get(key)
        const lastSeen = posted?.lastSeen ?? null
        const health: AccountHealth =
          lastSeen === null
            ? 'silent'
            : now.getTime() - lastSeen.getTime() > QUIET_MS
              ? 'quiet'
              : 'ok'
        rows.push({
          rsn,
          teamId: team.id,
          member: member.name,
          lastSeen,
          posts: posted?.posts ?? 0,
          health,
        })
      }
    }
  }
  for (const [key, a] of seen) {
    if (rostered.has(key)) continue
    rows.push({
      rsn: a.rsn,
      teamId: null,
      member: null,
      lastSeen: a.lastSeen,
      posts: a.posts,
      health: 'unknown',
    })
  }
  const time = (r: AccountRow) => r.lastSeen?.getTime() ?? 0
  return rows.sort((a, b) => ORDER[a.health] - ORDER[b.health] || time(a) - time(b))
}
