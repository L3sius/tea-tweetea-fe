// The slot-machine reel: a strip of fake picks that scrolls past a marker and always stops on the
// real one, which the server chose. The fakes are jokes; only the winner means anything.

/** Joke picks the reel scrolls through on its way to the real one. */
export const FAKE_PICKS = [
  'First to go outside',
  'First to shower',
  'First to find a job',
  "First to leave mom's basement",
  'Last to stop crying',
  'First to touch grass',
  'First to call their mom back',
  'Last to blame lag',
  'First to log out willingly',
  'First to drink some water',
  'Most hours in Lumbridge',
  'First to sell a party hat',
  'First to explain this game to a date',
  'Last to say "just one more kill"',
  'First to buy a real gym membership',
  'First to read a book',
  'Slowest to log in',
  'First to wake up before noon',
  'First to tidy their room',
  'Most fish burnt',
]

/** Picks shown before the strip ends either side of the winner. */
const MARGIN = 4

export type ReelStrip = {
  labels: string[]
  /** Where the winner sits in `labels`; the reel stops on it. */
  winner: number
  /** Where the reel starts, so it travels from here to `winner`. */
  start: number
}

/**
 * A strip of `travel` fakes to scroll past before `winner`, with a few more either side so the
 * view never runs out. No pick shows twice in a row, and no fake has the winner's name.
 */
export function reelStrip(
  winner: string,
  travel = 32,
  fakes: readonly string[] = FAKE_PICKS,
  random: () => number = Math.random,
): ReelStrip {
  const pool = fakes.filter((f) => f !== winner)
  const count = MARGIN + 1 + travel + MARGIN
  const winnerAt = MARGIN
  const labels: string[] = []
  for (let i = 0; i < count; i++) {
    if (i === winnerAt) {
      labels.push(winner)
      continue
    }
    const before = labels[i - 1]
    const choices = pool.filter((f) => f !== before)
    labels.push(choices[Math.floor(random() * choices.length)] ?? pool[0] ?? winner)
  }
  return { labels, winner: winnerAt, start: winnerAt + travel }
}

/**
 * How far along the reel is at `t` (0 to 1 of the spin's time): fast at first, then a long crawl
 * past the last few picks, so the last moments tease which one it stops on.
 */
export const reelProgress = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 4
