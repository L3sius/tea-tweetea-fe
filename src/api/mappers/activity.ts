import type { Drop, FeedItem, Observation, StatRow } from '@/domain/activity'
import { teamId } from '@/domain/ids'
import type { WireFeedItem, WireObservation, WireStatRow } from '../wire/activity'
import { toDate } from './shared'

type WireDrop = Extract<WireObservation, { kind: 'loot' }>['items'][number]

const toDrop = (wire: WireDrop): Drop => ({
  name: wire.name,
  quantity: wire.quantity,
  priceEach: wire.price_each,
})

export function toObservation(wire: WireObservation): Observation {
  switch (wire.kind) {
    case 'loot':
      return { kind: 'loot', source: wire.source, items: wire.items.map(toDrop) }
    case 'clue':
      return { kind: 'clue', tier: wire.tier, items: wire.items.map(toDrop), region: wire.region }
    case 'kill_count':
    case 'slayer':
    case 'pet':
    case 'combat_achievement':
      return wire
  }
}

export const toFeedItem = (wire: WireFeedItem): FeedItem => ({
  id: wire.id,
  at: toDate(wire.at),
  rsn: wire.rsn,
  teamId: wire.team === null ? null : teamId(wire.team),
  kind: wire.kind,
  subject: wire.subject,
  value: wire.value,
  count: wire.count,
  observation: toObservation(wire.observation),
})

export const toStatRow = (wire: WireStatRow): StatRow => ({ ...wire })
