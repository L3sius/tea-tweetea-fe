// What the characters say over their heads, as OSRS overhead chat. Like the idle emotes, every
// choice is a hash of the server clock (see `chance` in acting.ts), so everyone watching sees the
// same quote at the same moment and nothing comes from the backend.
import type { TeamId } from '@/domain/ids'
import { chance, pick } from './acting'

/**
 * Said now and then by a character standing idle. `{player}` becomes a player from any team,
 * picked the same way for everyone. A line may start with OSRS chat effects, colour first, as
 * typed in game: `red:wave:Buying gf`, `flash1:gz`. Lines without one get a random effect now
 * and then (`EFFECT_CHANCE`).
 */
export const IDLE_QUOTES: readonly string[] = [
  'Buying gf',
  'Selling gf, cheap',
  'Free armour trimming!',
  'Doubling money, trade me',
  'gz',
  'Can I have free stuff pls?',
  'Drop party in Falador park, 5 mins!',
  'Meet in wildy',
  '1 more kc then I sleep',
  'this bingo is rigged',
  'Not dry, just unlucky',
  'Ironman btw',
  '$11 a month for this?',
  'Selling lobbies 200 ea',
  'brb mum says dinner',
  "pls don't pk me, I'm a hc",
  "wah wah i'm so unlucky",
  'Aaaaarrggghh... women! Run for your lives!',
  'Hello, would you like a worm?',
  'Tea is better than coffee',
  'Coffee is better than tea',
  '{player} is definitely botting.',
  'Who put a banana here?!',
  "Draw a Joker, they said. It'll be fun, they said.",
  'Next card is an Ace, I can feel it.',
  'One more tile, then I sleep.',
  "I'm not lost, I'm questing.",
  'Banana? In this economy?',
  'GM? I am a SUPER GM!',
  'Get egged!',
  'Bring back Zappa!',
  'Bring back Wick!',
  '{player} is chinese mole!',
  'Where is the Sug passage?',
  'Zingerrrr!',
  'Oh boy, time to go to Mcdonaldzzz',
]
// "Sit {player}", said about a player who just died, waits for the backend to report deaths: the
// activity feed has no death events yet.

/** Said by a walking team as it passes a team standing on its path, once per walk. */
export const PASS_QUOTE = 'get good, noob'

/** Chance that a minute of server time has a quote somewhere on the board. */
export const QUOTE_CHANCE_PER_MINUTE = 1

/** OSRS overhead chat colours. Flash colours blink between two; glow colours fade in a cycle. */
export const CHAT_COLOURS = [
  'yellow',
  'red',
  'green',
  'cyan',
  'purple',
  'white',
  'flash1',
  'flash2',
  'flash3',
  'glow1',
  'glow2',
  'glow3',
] as const
export type ChatColour = (typeof CHAT_COLOURS)[number]

/** OSRS overhead chat motions. */
export const CHAT_MOTIONS = ['none', 'wave', 'wave2', 'shake', 'scroll', 'slide'] as const
export type ChatMotion = (typeof CHAT_MOTIONS)[number]

export type ChatStyle = { colour: ChatColour; motion: ChatMotion }
export const PLAIN: ChatStyle = { colour: 'yellow', motion: 'none' }

/** Chance that a line with no effect of its own gets a random one. */
export const EFFECT_CHANCE = 0.3

const isColour = (word: string): word is ChatColour =>
  (CHAT_COLOURS as readonly string[]).includes(word)
const isMotion = (word: string): word is ChatMotion =>
  word !== 'none' && (CHAT_MOTIONS as readonly string[]).includes(word)

/**
 * Splits OSRS effect prefixes off a line: a colour, then a motion, each optional and followed by
 * a colon. `style` is null when the line has none.
 */
export function parseChat(line: string): { text: string; style: ChatStyle | null } {
  let rest = line
  let colour: ChatColour | null = null
  let motion: ChatMotion | null = null
  const head = /^([a-z0-9]+):/
  let m = head.exec(rest)
  if (m?.[1] && isColour(m[1])) {
    colour = m[1]
    rest = rest.slice(m[0].length)
    m = head.exec(rest)
  }
  if (m?.[1] && isMotion(m[1])) {
    motion = m[1]
    rest = rest.slice(m[0].length)
  }
  if (colour === null && motion === null) return { text: line, style: null }
  return { text: rest, style: { colour: colour ?? 'yellow', motion: motion ?? 'none' } }
}

/**
 * The style a line shows with: its own prefixes, or now and then a random effect, chosen by
 * `seed` so everyone sees the same one.
 */
export function chatStyle(
  line: string,
  ...seed: (string | number)[]
): ChatStyle & { text: string } {
  const { text, style } = parseChat(line)
  if (style) return { text, ...style }
  if (chance(...seed, 'chat-effect') >= EFFECT_CHANCE) return { text, ...PLAIN }
  // Either part may stay plain, but not both: an effect was rolled.
  const colour = pick(CHAT_COLOURS, ...seed, 'chat-colour') ?? 'yellow'
  const motion = pick(CHAT_MOTIONS, ...seed, 'chat-motion') ?? 'none'
  if (colour === 'yellow' && motion === 'none') return { text, colour: 'glow1', motion }
  return { text, colour, motion }
}

const MINUTE_MS = 60_000

/** How long a quote stays up: long enough to read, longer for longer lines. */
export const quoteMs = (text: string) => Math.min(6_000, Math.max(3_000, 2_000 + text.length * 70))

/** A line over a character's head, from `since` until `until` (server ms). */
export type Quote = { team: TeamId; text: string; style: ChatStyle; since: number; until: number }

/** Fills in `{player}`; null if the quote needs a player and there is none. */
export function fillQuote(text: string, players: readonly string[], ...seed: (string | number)[]) {
  if (!text.includes('{player}')) return text
  const player = pick(players, ...seed, 'quote-player')
  return player === null ? null : text.replaceAll('{player}', player)
}

/**
 * The idle quote on the board at `time`, if any: at most one a minute. The minute picks who says
 * it, what and when; the caller shows it only while that character stands idle. `teams` and
 * `players` must be in the same order for everyone (by id, by name).
 */
export function idleQuote(
  time: number,
  teams: readonly TeamId[],
  players: readonly string[],
  quotes: readonly string[] = IDLE_QUOTES,
  chancePerMinute = QUOTE_CHANCE_PER_MINUTE,
): Quote | null {
  const minute = Math.floor(time / MINUTE_MS)
  if (chance('quote', minute) >= chancePerMinute) return null
  const team = pick(teams, 'quote-team', minute)
  const line = pick(quotes, 'quote-text', minute)
  const filled = line === null ? null : fillQuote(line, players, minute)
  if (team === null || filled === null) return null
  const { text, ...style } = chatStyle(filled, 'quote', minute)
  const length = quoteMs(text)
  const since = minute * MINUTE_MS + chance('quote-at', minute) * (MINUTE_MS - length)
  const until = since + length
  return time >= since && time < until ? { team, text, style, since, until } : null
}
