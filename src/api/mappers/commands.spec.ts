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
      { kind: 'use_item', item: 'banana', target: { kind: 'tile', tileId: tileId(12) } },
      1,
      'k',
    )
    expect(onTile).toMatchObject({ target: { target: 'tile', id: 12 } })

    const onSelf = toWireTeamRequest({ kind: 'use_item', item: 'bronze_feather' }, 1, 'k')
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

  it('names the member who gets the credit for a tile completed by hand', () => {
    expect(
      toWireAdminAction({ kind: 'complete_tile', teamId: teamId(1), member: 'Zezima' }),
    ).toEqual({ action: 'complete_tile', team: 1, member: 'Zezima' })
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

describe('roster admin actions', () => {
  it('names the team by id and never sends a team code', () => {
    expect(toWireAdminAction({ kind: 'create_team', name: 'Red' })).toEqual({
      action: 'create_team',
      name: 'Red',
    })
    expect(toWireAdminAction({ kind: 'reset_team_code', teamId: teamId(2) })).toEqual({
      action: 'reset_team_code',
      team: 2,
    })
    expect(
      toWireAdminAction({
        kind: 'remove_account',
        teamId: teamId(0),
        member: 'Zez',
        rsn: 'Zez Alt',
      }),
    ).toEqual({ action: 'remove_account', team: 0, member: 'Zez', rsn: 'Zez Alt' })
    expect(
      toWireAdminAction({ kind: 'set_withdrawn', teamId: teamId(1), withdrawn: true }),
    ).toEqual({ action: 'set_withdrawn', team: 1, withdrawn: true })
  })
})
