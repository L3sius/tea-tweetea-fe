import type { AdminReply, CommandAccepted } from '@/domain/commands'
import { teamId } from '@/domain/ids'
import type { Hello, Me, Overview } from '@/domain/server'
import type { Item } from '@/domain/vocabulary'
import type { WireAdminReply, WireHello, WireMe, WireOverview } from '../wire/server'
import { toDate } from './shared'

export const toHello = (wire: WireHello): Hello => ({
  serverTime: toDate(wire.server_time),
  build: wire.build,
  seq: wire.seq,
})

// The schema only admits item names as keys.
const toItems = (items: WireMe['items']) => new Map(Object.entries(items) as [Item, number][])

export const toMe = (wire: WireMe): Me => ({
  teamId: teamId(wire.team),
  name: wire.name,
  items: toItems(wire.items),
  seq: wire.seq,
})

export const toOverview = (wire: WireOverview): Overview => ({
  seq: wire.seq,
  teams: new Map(
    wire.teams.map((t) => [teamId(t.team), { items: toItems(t.items), codeIssued: t.code_issued }]),
  ),
  accounts: wire.accounts.map((a) => ({
    rsn: a.rsn,
    teamId: a.team === null ? null : teamId(a.team),
    lastSeen: toDate(a.last_seen),
    posts: a.posts,
  })),
})

export const toAccepted = (wire: { seq: number }): CommandAccepted => ({
  kind: 'accepted',
  seq: wire.seq,
})

export function toAdminReply(wire: WireAdminReply): AdminReply {
  if ('dropped' in wire) return { kind: 'reverted', droppedSeqs: wire.dropped }
  if ('code' in wire)
    return { kind: 'issued', seq: wire.seq, teamId: teamId(wire.team), code: wire.code }
  return toAccepted(wire)
}
