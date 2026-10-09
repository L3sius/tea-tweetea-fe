import { describe, expect, it } from 'vitest'
import type { Team, TeamStatus } from './game'
import { instanceId, matchId, teamId, tileId } from './ids'
import { blockersOut, gainedItem, whyNotUsable } from './items'

const NOW = new Date('2026-10-06T12:00:00Z')

function team(status: TeamStatus, overrides: Partial<Team> = {}): Team {
  return {
    id: teamId(0),
    name: 'Red',
    members: [],
    position: tileId(1),
    status,
    frozenUntil: null,
    shieldUntil: null,
    matchId: null,
    gems: new Set(),
    gold: 100,
    effects: {
      moveMultiplier: 1,
      nextMoveHalved: false,
      suitGold: null,
      itemUsedHere: false,
    },
    tilesCompleted: 0,
    version: 1,
    appearance: null,
    ...overrides,
  }
}

const ready = team({ kind: 'ready' })

describe('whyNotUsable', () => {
  it('allows power-ups between finishing the tile and drawing', () => {
    expect(whyNotUsable(ready, 'bronze_feather', NOW)).toBeNull()
    expect(whyNotUsable(ready, 'ice_barrage', NOW)).toBeNull()
  })

  it('locks power-ups while the tile is unfinished', () => {
    const working = team({ kind: 'working', instanceId: instanceId(1) })
    expect(whyNotUsable(working, 'bronze_feather', NOW)).toBe('Finish your tile first')
  })

  it('is too late once the card is drawn, even though the server would allow a feather', () => {
    const drawn = team({
      kind: 'drawn',
      card: { kind: 'suited', rank: 4, suit: 'clubs' },
      steps: 4,
      length: 4,
      destinations: [],
    })
    expect(whyNotUsable(drawn, 'bronze_feather', NOW)).toBe('Too late: the card is drawn')
  })

  it('allows one item per tile', () => {
    const used = team({ kind: 'ready' }, { effects: { ...ready.effects, itemUsedHere: true } })
    expect(whyNotUsable(used, 'bronze_feather', NOW)).toMatch(/Already used/)
  })

  it('locks everything while frozen or in a match, even when ready', () => {
    const frozen = team({ kind: 'ready' }, { frozenUntil: new Date(NOW.getTime() + 60_000) })
    expect(whyNotUsable(frozen, 'bronze_feather', NOW)).toBe('Not while frozen')
    const fighting = team({ kind: 'ready' }, { matchId: matchId(1) })
    expect(whyNotUsable(fighting, 'bronze_feather', NOW)).toBe('Not during a match')
  })

  it('treats necklaces and Protect from Magic as kept, not used', () => {
    expect(whyNotUsable(ready, 'sapphire_necklace', NOW)).toBe('Works while held')
    expect(whyNotUsable(ready, 'protect_from_magic', NOW)).toBe('Works while held')
  })

  it('lets the Quetzal whistle work on land and the Ogre boat at sea only', () => {
    const land = {
      id: tileId(1),
      x: 0,
      y: 0,
      kind: 'normal',
      continent: 'blue',
      sea: false,
    } as const
    const sea = { ...land, sea: true }
    expect(whyNotUsable(ready, 'quetzal_whistle', NOW, land)).toBeNull()
    expect(whyNotUsable(ready, 'quetzal_whistle', NOW, sea)).toBe('Only works on land')
    expect(whyNotUsable(ready, 'ogre_boat', NOW, sea)).toBeNull()
    expect(whyNotUsable(ready, 'ogre_boat', NOW, land)).toBe('Only works at sea')
  })

  it('allows only as many blockers out as the rules say', () => {
    const one = { placed: 1, limit: 2 }
    const two = { placed: 2, limit: 2 }
    expect(whyNotUsable(ready, 'banana', NOW, undefined, one)).toBeNull()
    expect(whyNotUsable(ready, 'wilderness_web', NOW, undefined, two)).toMatch(/2 blockers out/)
    expect(whyNotUsable(ready, 'ice_barrage', NOW, undefined, two)).toBeNull()
  })
})

describe('blockersOut', () => {
  it('counts the team’s own blockers that are still on the board', () => {
    const later = new Date(NOW.getTime() + 60_000)
    const earlier = new Date(NOW.getTime() - 60_000)
    const blockers = new Map([
      [tileId(1), { item: 'banana', owner: teamId(0), until: later }],
      [tileId(2), { item: 'banana', owner: teamId(0), until: earlier }],
      [tileId(3), { item: 'banana', owner: teamId(1), until: later }],
    ] as const)
    expect(blockersOut(blockers, teamId(0), NOW)).toBe(1)
  })
})

describe('gainedItem', () => {
  it('finds the item whose count went up', () => {
    const before = new Map([['banana', 1]] as const)
    expect(gainedItem(before, new Map([['banana', 2]]))).toBe('banana')
    expect(
      gainedItem(
        before,
        new Map([
          ['banana', 1],
          ['ogre_boat', 1],
        ]),
      ),
    ).toBe('ogre_boat')
  })

  it('is null when nothing was gained', () => {
    const before = new Map([['banana', 1]] as const)
    expect(gainedItem(before, before)).toBeNull()
    expect(gainedItem(before, new Map())).toBeNull()
  })
})
