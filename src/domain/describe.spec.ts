import { beforeAll, describe, expect, it } from 'vitest'
import { decode } from '@/api/decode'
import { endpoints } from '@/api/endpoints'
import recordedItems from '@/api/fixtures/data/items.json'
import type { Observation } from './activity'
import type { Challenge } from './challenge'
import {
  cardLabel,
  challengeProgress,
  describeEvent,
  effortText,
  hoursText,
  itemName,
  mergedDrops,
  mergedText,
  observationText,
  partProgress,
  teamParts,
  teamStatusText,
  useQuestion,
} from './describe'
import type { Instance, Team } from './game'
import { challengeId, instanceId, teamId, tileId, type ChallengeId, type TeamId } from './ids'
import { useItemCatalogue } from './items'

// Item names come from the server's catalogue, as in the app: here, the one recorded from it.
beforeAll(() => {
  const { path, schema, map } = endpoints.items
  useItemCatalogue(decode(path, schema, map, recordedItems))
})

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

describe('compound tiles', () => {
  // As /challenges served it, with the parts trimmed of nothing.
  const wire = {
    'sire-chest-day': {
      id: 'sire-chest-day',
      name: 'Sire and Slayer',
      description:
        'Kill the Abyssal Sire 5 times, complete a dagannoth slayer task and open a hard clue casket',
      est_hours: 3,
      criterion: {
        kind: 'all',
        parts: [
          {
            name: 'Abyssal Sire kills',
            criterion: { kind: 'kill_count', bosses: ['Abyssal Sire'] },
            n: 5,
          },
          { name: 'Dagannoth task', criterion: { kind: 'slayer', tasks: ['Dagannoth'] }, n: 1 },
          {
            name: 'Hard casket',
            criterion: { kind: 'clue', tier: 'hard', filter: { by: 'count' } },
            n: 1,
          },
        ],
      },
      goal: { kind: 'each', n: 1 },
      effort: { kind: 'elapsed' },
    },
  }
  const { path, schema, map } = endpoints.challenges
  const sire = () => {
    const c = decode(path, schema, map, wire).get(challengeId('sire-chest-day'))
    if (!c) throw new Error('not decoded')
    return c
  }

  it('reads the parts, each with its own criterion and count', () => {
    const { criterion } = sire()
    expect(criterion.kind).toBe('all')
    if (criterion.kind !== 'all') return
    expect(criterion.parts.map((p) => [p.name, p.criterion.kind, p.n])).toEqual([
      ['Abyssal Sire kills', 'kill_count', 5],
      ['Dagannoth task', 'slayer', 1],
      ['Hard casket', 'clue', 1],
    ])
  })

  it('needs every part in full before the team has a standing, as the server counts it', () => {
    expect(challengeProgress(sire(), undefined, red)).toEqual({ done: 0, needed: 7 })
  })

  it('shows each part against its own count, capped at it', () => {
    const counts = new Map([
      ['Abyssal Sire kills', 7],
      ['Hard casket', 1],
    ])
    const standing = { counts, done: 6, target: 7, effort: null }
    expect(partProgress(sire(), standing)).toEqual([
      { name: 'Abyssal Sire kills', done: 5, needed: 5 },
      { name: 'Dagannoth task', done: 0, needed: 1 },
      { name: 'Hard casket', done: 1, needed: 1 },
    ])
    expect(partProgress(challenge({ kind: 'total', n: 1 }, []), standing)).toEqual([])
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
  it('names the team involved', () => {
    expect(describeEvent({ kind: 'gem_lost', teamId: red, gem: 'blue' }, names)).toBe(
      'Red lost the blue gem',
    )
  })

  it('leaves out bookkeeping events', () => {
    expect(describeEvent({ kind: 'stepped', teamId: red, tileId: 3 as never }, names)).toBeNull()
  })

  it('counts a one-tile walk in the singular', () => {
    const path = [tileId(1), tileId(2)]
    expect(describeEvent({ kind: 'move_confirmed', teamId: red, path }, names)).toBe(
      'Red set off 1 tile',
    )
  })

  it('names who an admin credited for a tile', () => {
    const done = { kind: 'tile_completed', teamId: red, tileId: tileId(3) } as const
    expect(describeEvent({ ...done, by: 'Zezima' }, names)).toBe(
      'Red completed a tile, credited to Zezima',
    )
    expect(describeEvent({ ...done, by: null }, names)).toBe('Red completed a tile')
  })
})

describe('teamStatusText', () => {
  // Only the status and the freeze matter here.
  const team = { status: { kind: 'ready' }, frozenUntil: null } as unknown as Team

  it('tells what the team is doing while the game runs', () => {
    expect(teamStatusText(team, new Date(), 'running')).toBe('Ready to draw a card')
  })

  it('says the game is over after the end, whatever the last status was', () => {
    expect(teamStatusText(team, new Date(), 'ended')).toBe('The game is over')
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

  it('tells how an account died, and to whom', () => {
    const death = (killer: string | null, pvp: boolean) =>
      observationText({ kind: 'death', killer, pvp })
    expect(death(null, false)).toBe('died')
    expect(death('Zulrah', false)).toBe('was killed by Zulrah')
    expect(death('Zezima', true)).toBe('was killed by Zezima (PvP)')
  })

  it('formats kill times', () => {
    expect(observationText({ kind: 'kill_count', boss: 'Zulrah', seconds: 65 })).toBe(
      'killed Zulrah in 1:05',
    )
  })
})

describe('mergedText', () => {
  const loot = (name: string, quantity = 1): Observation => ({
    kind: 'loot',
    source: 'Commander Zilyana',
    items: [{ name, quantity, priceEach: 1 }],
  })
  const kill = (seconds: number | null): Observation => ({
    kind: 'kill_count',
    boss: 'Royal Titans',
    seconds,
  })

  it('words a single item as before', () => {
    expect(mergedText([kill(78)], 1)).toEqual({ text: 'killed Royal Titans in 1:18', note: null })
  })

  it('names the source of merged loot, not one of its drops', () => {
    expect(mergedText([loot('Grimy ranarr weed'), loot('Coins', 19735)], 2)).toEqual({
      text: 'looted Commander Zilyana',
      note: null,
    })
    expect(mergedDrops([loot('Grimy ranarr weed'), loot('Coins', 19735)])).toEqual([
      'Grimy ranarr weed',
      '19735 × Coins',
    ])
  })

  it('gives merged kills their best time', () => {
    expect(mergedText([kill(78), kill(null), kill(76)], 3)).toEqual({
      text: 'killed Royal Titans',
      note: 'best 1:16',
    })
    expect(mergedText([kill(null)], 2)).toEqual({ text: 'killed Royal Titans', note: null })
  })

  it('makes merged caskets plural', () => {
    const clue: Observation = { kind: 'clue', tier: 'easy', items: [], region: null }
    expect(mergedText([clue, clue], 2).text).toBe('opened easy clue caskets')
  })
})

describe('private items', () => {
  it('names an item only to its own team', () => {
    const gained = (teamId: TeamId) =>
      describeEvent({ kind: 'item_gained', teamId, item: 'banana', reason: 'bought' }, names)
    expect(gained(red)).toBe('Red got a Banana')
    expect(gained(teamId(1))).toBe('Blue got an item')
  })

  it('tells of a mystery box without naming what came out of it', () => {
    const bought = (teamId: TeamId) =>
      describeEvent({ kind: 'bought', teamId, item: null, price: 40, mysteryBox: true }, names)
    expect(bought(red)).toBe('Red bought a mystery box for 40 gold')
    expect(bought(teamId(1))).toBe('Blue bought a mystery box for 40 gold')
  })

  it('still names an item a team uses, since its effect is public', () => {
    const used = { kind: 'item_used', teamId: teamId(1), item: 'banana', target: null } as const
    expect(describeEvent(used, names)).toBe('Blue used a Banana')
  })
})

describe('blockers', () => {
  it('says which blocker stopped a team', () => {
    const blocker = { item: 'harpie_bug_swarm', owner: red, until: new Date() } as const
    const event = {
      kind: 'blocker_triggered',
      teamId: teamId(1),
      tileId: tileId(4),
      blocker,
    } as const
    expect(describeEvent(event, names)).toBe('Blue was stopped by a harpie bug swarm')
  })

  it('writes freeze times in minutes or hours', () => {
    expect(hoursText(0.5)).toBe('30 minutes')
    expect(hoursText(1)).toBe('1 hour')
    expect(hoursText(4)).toBe('4 hours')
  })
})

describe('useQuestion', () => {
  it('asks in the words that fit each item', () => {
    expect(useQuestion('ice_barrage', 'Blue')).toBe('Cast Ice Barrage on Blue?')
    expect(useQuestion('morrigans_throwing_axe', 'Blue')).toBe(
      "Throw Morrigan's throwing axe at Blue?",
    )
    expect(useQuestion('handegg', 'Blue')).toBe('Throw the Handegg at Blue?')
    expect(useQuestion('banana', null)).toBe('Place the Banana on this tile?')
    expect(useQuestion('ogre_boat', null)).toBe('Sail away in the Ogre boat?')
    expect(useQuestion('bronze_feather', null)).toBe('Use the Bronze feather?')
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

describe('teamParts', () => {
  const teams = [
    { id: teamId(0), name: 'Red' },
    { id: teamId(1), name: 'Red Dragons' },
  ]
  it('splits out team names, the longest first', () => {
    expect(teamParts('Red Dragons stole the blue gem from Red', teams)).toEqual([
      { text: 'Red Dragons', team: 1 },
      { text: ' stole the blue gem from ', team: null },
      { text: 'Red', team: 0 },
    ])
  })

  it('leaves a line without team names whole', () => {
    expect(teamParts('The game has started!', teams)).toEqual([
      { text: 'The game has started!', team: null },
    ])
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
