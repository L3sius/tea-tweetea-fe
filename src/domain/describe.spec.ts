import { describe, expect, it } from 'vitest'
import type { Challenge } from './challenge'
import {
  cardLabel,
  challengeProgress,
  describeEvent,
  effortText,
  itemName,
  observationText,
} from './describe'
import type { Instance } from './game'
import { challengeId, instanceId, teamId, type ChallengeId, type TeamId } from './ids'

const names = {
  team: (id: TeamId) => ['Red', 'Blue'][id] ?? '?',
  challenge: (id: ChallengeId) => `challenge ${id}`,
  seesItems: (id: TeamId) => id === red,
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
    effort: { kind: 'kills', bosses },
  }
}

function instance(done: number, target: number, effort: number | null = null): Instance {
  return {
    id: instanceId(1),
    challengeId: challengeId('c'),
    startedAt: new Date(0),
    scope: { kind: 'tile', teamId: red, tileId: 0 as never },
    progress: new Map([[red, { counts: new Map(), done, target, effort }]]),
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
  it('uses the catalogue name', () => {
    expect(itemName('bronze_feather')).toBe('Bronze feather')
    expect(itemName('morrigans_throwing_axe')).toBe("Morrigan's throwing axe")
  })
})

describe('challengeProgress', () => {
  it('takes the server’s own done and target', () => {
    const c = challenge({ kind: 'each', n: 2 }, ['Vorkath', 'Zulrah'])
    expect(challengeProgress(c, instance(3, 4), red)).toEqual({ done: 3, needed: 4 })
  })

  it('needs every key of an each goal before the team has a standing', () => {
    const c = challenge({ kind: 'each', n: 2 }, ['Vorkath', 'Zulrah'])
    expect(challengeProgress(c, undefined, red)).toEqual({ done: 0, needed: 4 })
  })

  it('starts at zero without progress', () => {
    const c = challenge({ kind: 'total', n: 3 }, [])
    expect(challengeProgress(c, undefined, red)).toEqual({ done: 0, needed: 3 })
  })
})

describe('effortText', () => {
  const now = new Date(3 * 3_600_000 + 12 * 60_000)

  it('counts kills for a drop task, and shows nothing before an instance exists', () => {
    const c: Challenge = {
      ...challenge({ kind: 'total', n: 1 }, []),
      criterion: {
        kind: 'loot',
        filter: {
          kind: 'items',
          items: [{ name: 'Dragon pickaxe', aliases: [], sources: { kind: 'any' } }],
        },
      },
      effort: { kind: 'loots', sources: { kind: 'listed', names: ['Kalphite Queen'] } },
    }
    const i = instance(0, 1, 312)
    expect(effortText(c, i, i.progress.get(red), now)).toBe('312 kills')
    expect(effortText(c, undefined, undefined, now)).toBeNull()
  })

  it('leaves out kills for a kill-count task, which its progress bar already shows', () => {
    const c = challenge({ kind: 'total', n: 50 }, ['Abyssal Sire'])
    const i = instance(24, 50, 24)
    expect(effortText(c, i, i.progress.get(red), now)).toBeNull()
  })

  it('shows the best time against the limit', () => {
    const c: Challenge = {
      ...challenge({ kind: 'total', n: 1 }, []),
      criterion: { kind: 'timed_kill', boss: 'TzTok-Jad', maxSeconds: 26 * 60 },
      effort: { kind: 'best_time', boss: 'TzTok-Jad' },
    }
    const i = instance(0, 1, 27 * 60 + 14)
    expect(effortText(c, i, i.progress.get(red), now)).toBe('best 27:14 / 26:00')
    expect(effortText(c, instance(0, 1), undefined, now)).toBe('no time yet')
  })

  it('counts time on the task for elapsed effort', () => {
    const c: Challenge = { ...challenge({ kind: 'total', n: 1 }, []), effort: { kind: 'elapsed' } }
    expect(effortText(c, instance(0, 1), undefined, now)).toBe('working 3h 12m')
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

describe('private items', () => {
  it('names an item only to its own team', () => {
    const gained = (teamId: TeamId) =>
      describeEvent({ kind: 'item_gained', teamId, item: 'banana', reason: 'bought' }, names)
    expect(gained(red)).toBe('Red got a Banana')
    expect(gained(teamId(1))).toBe('Blue got an item')
  })

  it('still names an item a team uses, since its effect is public', () => {
    const used = { kind: 'item_used', teamId: teamId(1), item: 'banana', target: null } as const
    expect(describeEvent(used, names)).toBe('Blue used a Banana')
  })
})

describe('articles', () => {
  it('uses "an" before a vowel', () => {
    expect(
      describeEvent({ kind: 'item_used', teamId: red, item: 'ice_barrage', target: null }, names),
    ).toBe('Red used an Ice Barrage')
    expect(observationText({ kind: 'clue', tier: 'elite', items: [], region: null })).toBe(
      'opened an elite clue casket',
    )
  })
})

describe('card draws', () => {
  it('says "step" for one and "steps" for more', () => {
    const drew = (steps: number) =>
      describeEvent({ kind: 'card_drawn', teamId: red, card: { kind: 'joker' }, steps }, names)
    expect(drew(1)).toMatch(/\(1 step\)$/)
    expect(drew(4)).toMatch(/\(4 steps\)$/)
  })
})
