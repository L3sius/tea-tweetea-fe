import { describe, expect, it } from 'vitest'
import type { FeedItem } from '@/domain/activity'
import { teamId } from '@/domain/ids'
import {
  EFFECT_CHANCE,
  DEATH_EXCUSES,
  IDLE_QUOTES,
  chatStyle,
  deathQuotes,
  fillQuote,
  idleQuote,
  parseChat,
  quoteMs,
} from './quotes'

const teams = [teamId(0), teamId(1), teamId(2), teamId(3)]
const players = ['Bank Stander', 'Gnome Kid', 'Sewer Sam']
const MINUTE = 60_000

/** Every quote shown during one minute, sampled each 100 ms. */
function quotesIn(minute: number) {
  const seen = new Set<string>()
  for (let t = minute * MINUTE; t < (minute + 1) * MINUTE; t += 100) {
    const q = idleQuote(t, teams, players)
    if (q) seen.add(`${q.team}|${q.text}|${q.since}`)
  }
  return seen
}

describe('idleQuote', () => {
  it('says one quote a minute, the same for everyone', () => {
    for (let m = 29_000_000; m < 29_000_020; m++) expect(quotesIn(m).size).toBe(1)
    const t = 29_000_005 * MINUTE + 30_000
    expect(idleQuote(t, teams, players)).toEqual(idleQuote(t, teams, players))
  })

  it('keeps each quote up for its length, inside its minute', () => {
    const m = 29_000_003
    const start = m * MINUTE
    let first: ReturnType<typeof idleQuote> = null
    for (let t = start; t < start + MINUTE && !first; t += 50) first = idleQuote(t, teams, players)
    expect(first).not.toBeNull()
    if (!first) return
    expect(first.until - first.since).toBe(quoteMs(first.text))
    expect(first.until).toBeLessThanOrEqual(start + MINUTE)
  })

  it('says nothing in a minute the chance leaves out', () => {
    expect(quotesIn(29_000_000).size).toBe(1)
    let any = false
    for (let t = 29_000_000 * MINUTE; t < 29_000_001 * MINUTE; t += 100)
      any ||= idleQuote(t, teams, players, IDLE_QUOTES, 0) !== null
    expect(any).toBe(false)
  })

  it('fills in a player from any team', () => {
    const filled = fillQuote('{player} is definitely botting.', players, 7)
    expect(players.some((p) => filled === `${p} is definitely botting.`)).toBe(true)
    expect(fillQuote('{player} is definitely botting.', [], 7)).toBeNull()
    expect(fillQuote('gz', [], 7)).toBe('gz')
  })
})

describe('OSRS chat effects', () => {
  it('reads a colour and a motion off the front of a line, as typed in game', () => {
    expect(parseChat('red:wave:Buying gf')).toEqual({
      text: 'Buying gf',
      style: { colour: 'red', motion: 'wave' },
    })
    expect(parseChat('flash1:gz')).toEqual({
      text: 'gz',
      style: { colour: 'flash1', motion: 'none' },
    })
    expect(parseChat('shake:Sit')).toEqual({
      text: 'Sit',
      style: { colour: 'yellow', motion: 'shake' },
    })
  })

  it('leaves a line alone when it starts with no known effect', () => {
    expect(parseChat('gz')).toEqual({ text: 'gz', style: null })
    expect(parseChat('note: not an effect')).toEqual({ text: 'note: not an effect', style: null })
  })

  it('keeps a line its own effect, and gives some other lines a random one', () => {
    expect(chatStyle('glow2:slide:hi', 1)).toEqual({ text: 'hi', colour: 'glow2', motion: 'slide' })
    let styled = 0
    for (let seed = 0; seed < 1000; seed++) {
      const s = chatStyle('gz', seed)
      if (s.colour !== 'yellow' || s.motion !== 'none') styled++
    }
    expect(styled / 1000).toBeCloseTo(EFFECT_CHANCE, 1)
    expect(chatStyle('gz', 42)).toEqual(chatStyle('gz', 42))
  })
})

describe('deathQuotes', () => {
  const T = Date.parse('2026-10-10T12:00:00Z')
  const death = (id: number, team: number, rsn: string, at: number): FeedItem => ({
    id,
    at: new Date(at),
    rsn,
    teamId: teamId(team),
    kind: 'death',
    subject: 'Zulrah',
    value: 0,
    count: 1,
    observation: { kind: 'death', killer: 'Zulrah', pvp: false },
  })

  it('has every other team say "Sit <name>", and the dead player’s team make an excuse', () => {
    const feed = [death(7, 1, 'Gnome Kid', T)]
    expect(deathQuotes(feed, teams, T)).toEqual([])
    // Each line starts within a moment of the others, so a second later all of them are up.
    const quotes = deathQuotes(feed, teams, T + 3_000)
    expect(quotes.map((q) => q.team).sort()).toEqual(teams)
    for (const q of quotes.filter((q) => q.team !== teamId(1))) expect(q.text).toBe('Sit Gnome Kid')
    const excuse = quotes.find((q) => q.team === teamId(1))?.text
    expect(DEATH_EXCUSES.map((e) => e.replace('{killer}', 'Zulrah'))).toContain(excuse)
    expect(deathQuotes(feed, teams, T + 3_000)).toEqual(quotes)
  })

  it('leaves out excuses that name a killer when Dink names none', () => {
    const unknown: FeedItem = {
      ...death(9, 1, 'Gnome Kid', T),
      observation: { kind: 'death', killer: null, pvp: false },
    }
    for (let id = 0; id < 50; id++) {
      const [excuse] = deathQuotes([{ ...unknown, id }], [teamId(1)], T + 3_000)
      expect(excuse?.text).not.toMatch(/\{killer\}|nerf $| is overtuned/)
    }
  })

  it('lets a taunt end, and says nothing for other activity', () => {
    const feed = [death(7, 1, 'Gnome Kid', T)]
    expect(deathQuotes(feed, teams, T + 60_000)).toEqual([])
    const loot: FeedItem = {
      ...death(8, 1, 'Gnome Kid', T),
      kind: 'loot',
      observation: { kind: 'loot', source: 'Zulrah', items: [] },
    }
    expect(deathQuotes([loot], teams, T + 2_500)).toEqual([])
  })
})
