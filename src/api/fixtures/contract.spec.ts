import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type { StatsGroup } from '@/domain/activity'
import { decode } from '../decode'
import { endpoints } from '../endpoints'
import { ITEM_TARGET } from '@/domain/items'
import { ITEMS } from '@/domain/vocabulary'

// Recorded responses from a real server must pass our schemas. When the backend changes, refresh
// the recordings (`npm run fixtures:refresh`) and these tests point at what moved.

const files = import.meta.glob<string>('./data/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
})

function read(name: string): unknown {
  const text = files[`./data/${name}.json`]
  if (text === undefined) throw new Error(`No fixture ${name}`)
  return JSON.parse(text)
}

function fromFixture<S extends z.ZodType, D>(
  endpoint: { path: string; schema: S; map: (wire: z.output<S>) => D },
  file: string,
): D {
  return decode(endpoint.path, endpoint.schema, endpoint.map, read(file))
}

const board = fromFixture(endpoints.board, 'board')
const challenges = fromFixture(endpoints.challenges, 'challenges')
const state = fromFixture(endpoints.state, 'state')
const items = fromFixture(endpoints.items, 'items')
const rules = fromFixture(endpoints.rules, 'rules')

describe('recorded /items and /rules', () => {
  it('describes every item, with the numbers the site shows', () => {
    expect(ITEMS.filter((item) => !items.items.has(item))).toEqual([])
    const blockers = ITEMS.filter((item) => ITEM_TARGET[item] === 'tile')
    expect(blockers.filter((item) => !items.items.get(item)?.freezeHours)).toEqual([])
    const feathers = ['bronze_feather', 'silver_feather', 'gold_feather'] as const
    expect(feathers.filter((item) => !items.items.get(item)?.multiplier)).toEqual([])
  })

  it('quotes no placeholders the server failed to fill in', () => {
    for (const entry of [...items.items.values(), items.mysteryBox])
      expect(entry.description).not.toMatch(/[{}]/)
  })

  it('serves the limits the site checks against', () => {
    expect(rules.blockerRange).toBeGreaterThan(0)
    expect(rules.blockersPerTeam).toBeGreaterThan(0)
    expect(rules.inventoryLimit).toBeGreaterThan(0)
  })
})

describe('recorded /board', () => {
  it('connects roads only between known tiles', () => {
    for (const [a, b] of board.roads) {
      expect(board.tiles.has(a)).toBe(true)
      expect(board.tiles.has(b)).toBe(true)
    }
  })

  it('has eight continents, each with somewhere to place its gem', () => {
    expect(board.continents).toHaveLength(8)
    for (const continent of board.continents) expect(continent.gemSpots.length).toBeGreaterThan(0)
  })
})

describe('recorded /state', () => {
  it('deals a known challenge to every board tile', () => {
    expect(state.tileChallenges.size).toBe(board.tiles.size)
    for (const id of state.tileChallenges.values()) expect(challenges.has(id)).toBe(true)
  })

  it('places each gem on one of its own continent’s gem spots', () => {
    for (const continent of board.continents) {
      expect(continent.gemSpots).toContain(state.gemTiles.get(continent.gem))
    }
  })

  it('stands every team on a board tile', () => {
    for (const team of state.teams.values()) expect(board.tiles.has(team.position)).toBe(true)
  })

  it('points working teams at an active instance', () => {
    for (const team of state.teams.values()) {
      if (team.status.kind === 'working') {
        expect(state.instances.has(team.status.instanceId)).toBe(true)
      }
    }
  })
})

describe('recorded /events', () => {
  const journal = fromFixture(endpoints.journal, 'events')

  it('decodes every entry in sequence order', () => {
    expect(journal.length).toBeGreaterThan(0)
    const seqs = journal.map((entry) => entry.seq)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(journal.at(-1)?.seq).toBe(state.seq)
  })
})

describe('recorded /feed and /stats', () => {
  it('decodes the feed newest first', () => {
    const feed = fromFixture(endpoints.feed, 'feed')
    const ids = feed.map((item) => item.id)
    expect(ids).toEqual([...ids].sort((a, b) => b - a))
  })

  it.each<StatsGroup>(['account', 'team', 'subject', 'hour'])('decodes stats by %s', (by) => {
    expect(() => fromFixture(endpoints.stats, `stats-by-${by}`)).not.toThrow()
  })
})
