import type { AdminReply, CommandAccepted } from '@/domain/commands'
import { teamId } from '@/domain/ids'
import type { Hello, TeamIdentity } from '@/domain/server'
import type { WireAdminReply, WireHello, WireMe } from '../wire/server'
import { toDate } from './shared'

export const toHello = (wire: WireHello): Hello => ({
  serverTime: toDate(wire.server_time),
  build: wire.build,
  seq: wire.seq,
})

export const toTeamIdentity = (wire: WireMe): TeamIdentity => ({
  teamId: teamId(wire.team),
  name: wire.name,
})

export const toAccepted = (wire: { seq: number }): CommandAccepted => ({
  kind: 'accepted',
  seq: wire.seq,
})

export const toAdminReply = (wire: WireAdminReply): AdminReply =>
  'dropped' in wire ? { kind: 'reverted', droppedSeqs: wire.dropped } : toAccepted(wire)
