// What the characters say over their heads, as OSRS overhead chat. Like the idle emotes, every
// choice is a hash of the server clock (see `chance` in acting.ts), so everyone watching sees the
// same quote at the same moment and nothing comes from the backend.
import type { FeedItem } from '@/domain/activity'
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
/** Said by a walking team as it passes a team standing on its path, once per walk. */
export const PASS_QUOTE = 'get good, noob'

/** Said by every other team's character when a player dies (Dink reports it in the feed). */
export const DEATH_QUOTE = 'Sit {player}'

/**
 * Said by the character of the team the player died for, while the others say "Sit". `{killer}`
 * becomes what killed them; those lines are left out when Dink doesn't say.
 */
export const DEATH_EXCUSES: readonly string[] = [
  'lag',
  'I was AFK, I swear',
  'my prayer was on, I promise',
  'nerf {killer}',
  '{killer} is overtuned',
  'there goes my gear',
  "grave timer's ticking, brb",
  'that was a misclick',
  'uninstalling',
  'rng hates me',
]

/** How long after a death the taunts come: long enough for the feed to have reached every page. */
const DEATH_QUOTE_DELAY_MS = 2_000
/** The taunts start up to this far apart, so they don't all appear on one frame. */
const DEATH_QUOTE_SPREAD_MS = 600

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

/** The longest a quote stays up. */
const QUOTE_MAX_MS = 6_000

/** How long a quote stays up: long enough to read, longer for longer lines. */
export const quoteMs = (text: string) =>
  Math.min(QUOTE_MAX_MS, Math.max(3_000, 2_000 + text.length * 70))

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

/**
 * What the characters say about recent deaths at `time`: every other team says "Sit <name>", and
 * the team the player died for makes an excuse. The death's id picks the excuse and when each line
 * starts, so every page shows the same. `feed` is the activity feed as every page loads it; `teams`
 * must be in the same order for everyone.
 */
export function deathQuotes(
  feed: readonly FeedItem[],
  teams: readonly TeamId[],
  time: number,
): Quote[] {
  const out: Quote[] = []
  for (const item of feed) {
    const death = item.observation
    if (death.kind !== 'death') continue
    const at = item.at.getTime() + DEATH_QUOTE_DELAY_MS
    // The feed is newest first: once one is too old to still show, the rest are older.
    if (at + DEATH_QUOTE_SPREAD_MS + QUOTE_MAX_MS < time) break
    const excuses = DEATH_EXCUSES.filter(
      (line) => death.killer !== null || !line.includes('{killer}'),
    )
    for (const team of teams) {
      const line =
        team === item.teamId
          ? (pick(excuses, 'death-excuse', item.id) ?? '').replace('{killer}', death.killer ?? '')
          : DEATH_QUOTE.replace('{player}', item.rsn)
      if (!line) continue
      const { text, ...style } = chatStyle(line, 'death', item.id, team)
      const since = at + chance('death-at', item.id, team) * DEATH_QUOTE_SPREAD_MS
      const until = since + quoteMs(text)
      if (time >= since && time < until) out.push({ team, text, style, since, until })
    }
  }
  return out
}
