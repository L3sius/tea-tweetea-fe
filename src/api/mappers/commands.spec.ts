import { describe, expect, it } from 'vitest'
import { instanceId, teamId, tileId } from '@/domain/ids'
import { toWireAdminAction, toWireTeamRequest } from './commands'

describe('team requests', () => {
  it('carries the version and idempotency key with every action', () => {
    expect(toWireTeamRequest({ kind: 'draw' }, 91, 'key-1')).toEqual({
      version: 91,
      key: 'key-1',
      action: 'draw',
    })
  })

  it('sends the whole path as plain tile ids', () => {
    const path = [455, 456, 457].map(tileId)
    expect(toWireTeamRequest({ kind: 'confirm_path', path }, 1, 'k')).toMatchObject({
      action: 'confirm_path',
      path: [455, 456, 457],
    })
  })

  it('includes an item target only when there is one', () => {
    const onTile = toWireTeamRequest(
      { kind: 'use_item', item: 'banana_peel', target: { kind: 'tile', tileId: tileId(12) } },
      1,
      'k',
    )
    expect(onTile).toMatchObject({ target: { target: 'tile', id: 12 } })

    const onSelf = toWireTeamRequest({ kind: 'use_item', item: 'owls_feather' }, 1, 'k')
    expect(onSelf).not.toHaveProperty('target')
  })
})

describe('admin actions', () => {
  it('renames domain fields to wire fields', () => {
    expect(
      toWireAdminAction({
        kind: 'contribute',
        teamId: teamId(1),
        instanceId: instanceId(17),
        key: 'Dragon pickaxe',
        amount: 1,
      }),
    ).toEqual({ action: 'contribute', team: 1, instance: 17, key: 'Dragon pickaxe', amount: 1 })
  })

  it('sends dev cards in the server’s card shape', () => {
    const team = teamId(2)
    expect(
      toWireAdminAction({
        kind: 'dev_draw_card',
        teamId: team,
        card: { kind: 'suited', rank: 14, suit: 'spades' },
      }),
    ).toEqual({ action: 'dev_draw_card', team: 2, card: { rank: 14, suit: 'spades' } })
    expect(
      toWireAdminAction({ kind: 'dev_draw_card', teamId: team, card: { kind: 'joker' } }),
    ).toEqual({ action: 'dev_draw_card', team: 2, card: { rank: 0, suit: null } })
  })

  it('converts observations back to the wire format', () => {
    expect(
      toWireAdminAction({
        kind: 'observe',
        rsn: 'Red Archer',
        observation: {
          kind: 'loot',
          source: 'Kalphite Queen',
          items: [{ name: 'Dragon pickaxe', quantity: 1, priceEach: 2_000_000 }],
        },
      }),
    ).toEqual({
      action: 'observe',
      rsn: 'Red Archer',
      observation: {
        kind: 'loot',
        source: 'Kalphite Queen',
        items: [{ name: 'Dragon pickaxe', quantity: 1, price_each: 2_000_000 }],
      },
    })
  })
})
