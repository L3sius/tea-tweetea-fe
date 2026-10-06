import { describe, expect, it } from 'vitest'
import { instanceId, teamId, tileId } from '@/domain/ids'
import { WireCard, WireState, type WireTeam } from '../wire/game'
import { toCard, toGameState, toTeam } from './game'

const wireTeam = (overrides: Partial<WireTeam> = {}): WireTeam => ({
  id: 2,
  name: 'Green',
  members: [{ name: 'Green Mage', accounts: ['Green Mage', 'Green Alt'] }],
  position: 40,
  status: { status: 'ready' },
  frozen_until: null,
  match_id: null,
  gems: ['blue', 'white'],
  gold: 55,
  items: { owls_feather: 2 },
  cards_left: 30,
  effects: {
    multiplier: 1,
    rain: false,
    suit_gold: null,
    item_used_here: false,
  },
  tiles_completed: 12,
  version: 7,
  ...overrides,
})

describe('cards', () => {
  it('reads rank 0 without a suit as a Joker', () => {
    expect(toCard({ rank: 0, suit: null })).toEqual({ kind: 'joker' })
  })

  it('keeps the rank and suit of a suited card', () => {
    expect(toCard({ rank: 14, suit: 'spades' })).toEqual({
      kind: 'suited',
      rank: 14,
      suit: 'spades',
    })
  })

  it.each([
    { rank: 0, suit: 'clubs' },
    { rank: 7, suit: null },
    { rank: 1, suit: 'hearts' },
    { rank: 15, suit: 'hearts' },
  ])('rejects the impossible card %o', (card) => {
    expect(WireCard.safeParse(card).success).toBe(false)
  })
})

describe('teams', () => {
  it('nests the flattened moving status into a move', () => {
    const team = toTeam(
      wireTeam({
        status: {
          status: 'moving',
          path: [40, 41, 42],
          at: 1,
          pauses: [{ pause: 'match', id: null, opponent: 3 }],
          checked: false,
        },
      }),
    )
    expect(team.status).toEqual({
      kind: 'moving',
      move: {
        path: [40, 41, 42],
        atIndex: 1,
        pauses: [{ kind: 'match', matchId: null, opponent: 3 }],
        currentTileResolved: false,
      },
    })
  })

  it('turns collections into sets and maps', () => {
    const team = toTeam(wireTeam())
    expect(team.gems).toEqual(new Set(['blue', 'white']))
    expect(team.items).toEqual(new Map([['owls_feather', 2]]))
  })

  it('names the suit-gold tuple', () => {
    const team = toTeam(wireTeam({ effects: { ...wireTeam().effects, suit_gold: ['clubs', 3] } }))
    expect(team.effects.suitGold).toEqual({ suit: 'clubs', drawsLeft: 3 })
  })

  it('parses the freeze time', () => {
    const team = toTeam(wireTeam({ frozen_until: '2026-10-05T12:00:00Z' }))
    expect(team.frozenUntil).toEqual(new Date('2026-10-05T12:00:00Z'))
  })
})

describe('game state', () => {
  const wireState = {
    seq: 10,
    server_time: '2026-10-05T12:00:00Z',
    phase: 'running',
    teams: [wireTeam()],
    tiles: ['a', 'b', 'c'],
    gems: [0, 1, 2, 0, 1, 2, 0, 1],
    blockers: { '1': { blocker: 'rock', until: '2026-10-05T14:00:00Z' } },
    boot: null,
    instances: {
      '17': {
        challenge: 'a',
        started: '2026-10-05T11:00:00Z',
        scope: { scope: 'tile', team: 2, tile: 0 },
        progress: { '2': { 'Dragon pickaxe': 1 } },
        done: [],
      },
    },
    minigames: {},
    matches: {},
  }

  it('keys maps by numeric id', () => {
    const state = toGameState(WireState.parse(wireState))
    expect(state.blockers.get(tileId(1))).toEqual({
      kind: 'rock',
      until: new Date('2026-10-05T14:00:00Z'),
    })
    const instance = state.instances.get(instanceId(17))
    expect(instance?.id).toBe(17)
    expect(instance?.progress.get(teamId(2))).toEqual(new Map([['Dragon pickaxe', 1]]))
  })

  it('indexes tile challenges by tile id and gem tiles by gem', () => {
    const state = toGameState(WireState.parse(wireState))
    expect(state.tileChallenges.get(tileId(2))).toBe('c')
    expect(state.gemTiles.get('purple')).toBe(2)
    expect(state.gemTiles.get('white')).toBe(1)
  })

  it('rejects a state without exactly one tile per gem', () => {
    expect(WireState.safeParse({ ...wireState, gems: [0, 1] }).success).toBe(false)
  })

  it('rejects non-numeric map keys', () => {
    const blockers = { first: { blocker: 'bees' } }
    expect(WireState.safeParse({ ...wireState, blockers }).success).toBe(false)
  })
})
