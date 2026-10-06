import { describe, expect, it } from 'vitest'
import type { Challenge } from './challenge'
import { cardLabel, challengeProgress, describeEvent, itemName, observationText } from './describe'
import type { Instance } from './game'
import { challengeId, instanceId, teamId, type ChallengeId, type TeamId } from './ids'

const names = {
  team: (id: TeamId) => ['Red', 'Blue'][id] ?? '?',
  challenge: (id: ChallengeId) => `challenge ${id}`,
}

const red = teamId(0)

function challenge(goal: Challenge['goal'], bosses: string[]): Challenge {
  return {
    id: challengeId('c'),
    name: 'Bosses',
    description: '',
    estHours: 1,
    tags: [],
    criterion: { kind: 'kill_count', bosses },
    goal,
  }
}

function instance(counts: Record<string, number>): Instance {
  return {
    id: instanceId(1),
    challengeId: challengeId('c'),
    startedAt: new Date(0),
    scope: { kind: 'tile', teamId: red, tileId: 0 as never },
    progress: new Map([[red, new Map(Object.entries(counts))]]),
    done: new Set(),
  }
}

describe('cardLabel', () => {
  it('shows faces and suits', () => {
    expect(cardLabel({ kind: 'suited', rank: 4, suit: 'clubs' })).toBe('4♣')
    expect(cardLabel({ kind: 'suited', rank: 14, suit: 'hearts' })).toBe('A♥')
    expect(cardLabel({ kind: 'joker' })).toBe('Joker')
  })
})

describe('itemName', () => {
  it('uses the rulebook spelling where it differs from the id', () => {
    expect(itemName('owls_feather')).toBe("Owl's Feather")
    expect(itemName('migrant_bird')).toBe('Migrant Bird')
  })
})

describe('challengeProgress', () => {
  it('caps a total goal at what it needs', () => {
    const c = challenge({ kind: 'total', n: 5 }, ['Vorkath', 'Zulrah'])
    expect(challengeProgress(c, instance({ Vorkath: 4, Zulrah: 3 }), red)).toEqual({
      done: 5,
      needed: 5,
    })
  })

  it('counts every key of an each goal separately', () => {
    const c = challenge({ kind: 'each', n: 2 }, ['Vorkath', 'Zulrah'])
    expect(challengeProgress(c, instance({ Vorkath: 3 }), red)).toEqual({ done: 2, needed: 4 })
  })

  it('starts at zero without progress', () => {
    const c = challenge({ kind: 'total', n: 3 }, [])
    expect(challengeProgress(c, undefined, red)).toEqual({ done: 0, needed: 3 })
  })
})

describe('describeEvent', () => {
  it('names the teams involved', () => {
    expect(
      describeEvent({ kind: 'gem_stolen', from: teamId(1), to: red, gem: 'blue' }, names),
    ).toBe('Red stole the blue gem from Blue')
  })

  it('leaves out bookkeeping events', () => {
    expect(describeEvent({ kind: 'stepped', teamId: red, tileId: 3 as never }, names)).toBeNull()
  })
})

describe('observationText', () => {
  it('summarises loot', () => {
    expect(
      observationText({
        kind: 'loot',
        source: 'Vorkath',
        items: [
          { name: 'Dragonbone necklace', quantity: 1, priceEach: 1 },
          { name: 'Coins', quantity: 5000, priceEach: 1 },
        ],
      }),
    ).toBe('got Dragonbone necklace and 1 more from Vorkath')
  })

  it('formats kill times', () => {
    expect(observationText({ kind: 'kill_count', boss: 'Zulrah', seconds: 65 })).toBe(
      'killed Zulrah in 1:05',
    )
  })
})

describe('articles', () => {
  it('uses "an" before a vowel', () => {
    expect(
      describeEvent({ kind: 'item_used', teamId: red, item: 'owls_feather', target: null }, names),
    ).toBe("Red used an Owl's Feather")
    expect(observationText({ kind: 'clue', tier: 'elite', items: [], region: null })).toBe(
      'opened an elite clue casket',
    )
  })
})
