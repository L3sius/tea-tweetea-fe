// Shaping the drops feed for display: filters plus guards so one busy player can't flood it.
import type { FeedItem, ObservationKind } from './activity'
import type { TeamId } from './ids'

export type FeedFilter = {
  teamId: TeamId | null
  kind: ObservationKind | null
  /** Case-insensitive part of a player name. */
  rsn: string
  /** Loot and clues below this gp value are hidden. */
  minValue: number
}

export const NO_FILTER: FeedFilter = { teamId: null, kind: null, rsn: '', minValue: 0 }

/** Repeats of the same thing by the same player within this window merge into one row. */
export const MERGE_WINDOW_MS = 15 * 60_000
/** Rows one player may show within `BURST_WINDOW_MS` before the rest fold away. */
export const BURST_LIMIT = 3
export const BURST_WINDOW_MS = 10 * 60_000

export type FeedRow =
  | { kind: 'item'; key: string; item: FeedItem; count: number; value: number }
  | { kind: 'folded'; key: string; rsn: string; teamId: TeamId | null; hidden: FeedItem[] }

export function matchesFilter(item: FeedItem, filter: FeedFilter): boolean {
  if (filter.teamId !== null && item.teamId !== filter.teamId) return false
  if (filter.kind !== null && item.kind !== filter.kind) return false
  if (filter.rsn && !item.rsn.toLowerCase().includes(filter.rsn.trim().toLowerCase())) return false
  const valued = item.kind === 'loot' || item.kind === 'clue'
  if (valued && item.value < filter.minValue) return false
  return true
}

/**
 * Newest-first rows: filtered, with repeats merged and each player's bursts folded so the feed
 * stays readable when someone farms a boss. `expanded` lists players whose folds are opened.
 */
export function feedRows(
  items: readonly FeedItem[],
  filter: FeedFilter,
  expanded: ReadonlySet<string> = new Set(),
): FeedRow[] {
  const rows: FeedRow[] = []
  const lastRow = new Map<string, Extract<FeedRow, { kind: 'item' }>>()
  const recent = new Map<string, number[]>()
  const fold = new Map<string, Extract<FeedRow, { kind: 'folded' }>>()

  for (const item of items) {
    if (!matchesFilter(item, filter)) continue

    // Merge a repeat into the newer row it repeats.
    const sameKey = `${item.rsn}|${item.kind}|${item.subject}`
    const previous = lastRow.get(sameKey)
    if (previous && previous.item.at.getTime() - item.at.getTime() <= MERGE_WINDOW_MS) {
      previous.count += item.count
      previous.value += item.value
      continue
    }

    // Fold a player's rows past the burst limit.
    const times = (recent.get(item.rsn) ?? []).filter(
      (t) => t - item.at.getTime() <= BURST_WINDOW_MS,
    )
    if (times.length >= BURST_LIMIT && !expanded.has(item.rsn)) {
      let folded = fold.get(item.rsn)
      if (!folded) {
        folded = {
          kind: 'folded',
          key: `fold-${item.id}`,
          rsn: item.rsn,
          teamId: item.teamId,
          hidden: [],
        }
        fold.set(item.rsn, folded)
        rows.push(folded)
      }
      folded.hidden.push(item)
      continue
    }
    times.push(item.at.getTime())
    recent.set(item.rsn, times)
    fold.delete(item.rsn)

    const row = {
      kind: 'item' as const,
      key: `item-${item.id}`,
      item,
      count: item.count,
      value: item.value,
    }
    lastRow.set(sameKey, row)
    rows.push(row)
  }
  return rows
}
