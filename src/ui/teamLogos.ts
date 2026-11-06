import type { Team } from '@/domain/game'

// Team logos ship with the site (public/teams) until the server can hold them. They are looked up
// by the team's name, not its id: the sample game and the fixtures reuse the live ids for other
// teams, so an id would put a live team's logo on a stranger.
const LOGOS: Record<string, string> = {
  "Dhilly's Dirty Diamonds": 'ddd.webp',
  "Eve's Big Gems": 'ebg.webp',
  'What Team Am I On': 'wtaio.webp',
  'Bground Boys': 'bb.webp',
}

/** The URL of the team's logo, or `null` for a team without one. */
export function teamLogo(team: Pick<Team, 'name'>): string | null {
  const file = LOGOS[team.name.trim()]
  return file ? `${import.meta.env.BASE_URL}teams/${file}` : null
}
