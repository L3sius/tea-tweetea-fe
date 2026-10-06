import { describe, expect, it } from 'vitest'
import type { Team, TeamStatus } from './game'
import { instanceId, matchId, teamId, tileId } from './ids'
import { whyNotUsable } from './items'

const NOW = new Date('2026-10-06T12:00:00Z')

function team(status: TeamStatus, overrides: Partial<Team> = {}): Team {
  return {
    id: teamId(0),
    name: 'Red',
    members: [],
    position: tileId(1),
    status,
    frozenUntil: null,
    matchId: null,
    gems: new Set(),
    gold: 100,
    items: new Map(),
    cardsLeft: 50,
    effects: {
      moveMultiplier: 1,
      nextMoveHalved: false,
      suitGold: null,
      itemUsedHere: false,
    },
    tilesCompleted: 0,
    version: 1,
    ...overrides,
  }
}

const ready = team({ kind: 'ready' })

describe('whyNotUsable', () => {
  it('allows power-ups between finishing the tile and drawing', () => {
    expect(whyNotUsable(ready, 'owls_feather', NOW)).toBeNull()
    expect(whyNotUsable(ready, 'sleeping_potion', NOW)).toBeNull()
  })

  it('locks power-ups while the tile is unfinished', () => {
    const working = team({ kind: 'working', instanceId: instanceId(1) })
    expect(whyNotUsable(working, 'owls_feather', NOW)).toBe('Finish your tile first')
  })

  it('is too late once the card is drawn, even though the server would allow a feather', () => {
    const drawn = team({
      kind: 'drawn',
      card: { kind: 'suited', rank: 4, suit: 'clubs' },
      steps: 4,
      length: 4,
      destinations: [],
    })
    expect(whyNotUsable(drawn, 'owls_feather', NOW)).toBe('Too late: the card is drawn')
  })

  it('allows one item per tile', () => {
    const used = team({ kind: 'ready' }, { effects: { ...ready.effects, itemUsedHere: true } })
    expect(whyNotUsable(used, 'owls_feather', NOW)).toMatch(/Already used/)
  })

  it('locks everything while frozen or in a match, even when ready', () => {
    const frozen = team({ kind: 'ready' }, { frozenUntil: new Date(NOW.getTime() + 60_000) })
    expect(whyNotUsable(frozen, 'owls_feather', NOW)).toBe('Not while frozen')
    const fighting = team({ kind: 'ready' }, { matchId: matchId(1) })
    expect(whyNotUsable(fighting, 'owls_feather', NOW)).toBe('Not during a match')
  })

  it('treats bells and the Monk’s Pendant as kept, not used', () => {
    expect(whyNotUsable(ready, 'blue_bell', NOW)).toBe('Works while held')
    expect(whyNotUsable(ready, 'monks_pendant', NOW)).toBe('Works while held')
  })
})
