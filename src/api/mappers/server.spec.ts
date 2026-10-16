import { describe, expect, it } from 'vitest'
import { teamId } from '@/domain/ids'
import { WireAdminReply } from '../wire/server'
import { toAdminReply, toMe, toOverview } from './server'

describe('toMe', () => {
  it('turns the private inventory into a map', () => {
    const me = toMe({ team: 0, name: 'Red', items: { bronze_feather: 2, banana: 1 }, seq: 42 })
    expect(me).toEqual({
      teamId: 0,
      name: 'Red',
      items: new Map([
        ['bronze_feather', 2],
        ['banana', 1],
      ]),
      seq: 42,
    })
  })
})

describe('toAdminReply', () => {
  const decodeReply = (wire: unknown) => toAdminReply(WireAdminReply.parse(wire))

  it('tells an issued code, an accepted command and a revert apart', () => {
    expect(decodeReply({ seq: 7, team: 2, code: 'abcd-efgh-jkmn-pqrs' })).toEqual({
      kind: 'issued',
      seq: 7,
      teamId: 2,
      code: 'abcd-efgh-jkmn-pqrs',
    })
    expect(decodeReply({ seq: 7 })).toEqual({ kind: 'accepted', seq: 7 })
    expect(decodeReply({ dropped: [7, 9] })).toEqual({ kind: 'reverted', droppedSeqs: [7, 9] })
  })
})

describe('toOverview', () => {
  it('keys teams by id and keeps accounts on no roster', () => {
    const overview = toOverview({
      seq: 3,
      teams: [{ team: 1, items: { banana: 2 }, code_issued: false }],
      accounts: [{ rsn: 'Typo', team: null, last_seen: '2026-10-15T12:00:00Z', posts: 4 }],
    })
    expect(overview.teams.get(teamId(1))).toEqual({
      items: new Map([['banana', 2]]),
      codeIssued: false,
    })
    expect(overview.accounts).toEqual([
      { rsn: 'Typo', teamId: null, lastSeen: new Date('2026-10-15T12:00:00Z'), posts: 4 },
    ])
  })
})
