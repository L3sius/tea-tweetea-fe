import { GEMS, type Gem } from '@/domain/vocabulary'

/** Converts a wire map keyed by a numeric id (`{ "17": ... }`) into a `Map`. */
export function mapIdKeyed<K, W, D>(
  record: Record<string, W>,
  toKey: (id: number) => K,
  toValue: (value: W, id: number) => D,
): Map<K, D> {
  return new Map(
    Object.entries(record).map(([key, value]) => [toKey(Number(key)), toValue(value, Number(key))]),
  )
}

/** Pairs each gem with the value at its index. The wire schemas guarantee one value per gem. */
export function byGemOrder<T>(values: readonly T[]): Map<Gem, T> {
  return new Map(
    GEMS.map((gem, index) => {
      const value = values[index]
      if (value === undefined) throw new Error(`Missing value for gem "${gem}"`)
      return [gem, value]
    }),
  )
}

export const toDate = (timestamp: string) => new Date(timestamp)
export const toDateOrNull = (timestamp: string | null) =>
  timestamp === null ? null : new Date(timestamp)
