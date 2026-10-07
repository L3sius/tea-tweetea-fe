import type { ItemEntry } from '@/domain/items'
import { ITEMS, type Item } from '@/domain/vocabulary'
import type { WireItems } from '../wire/items'

const known = new Set<string>(ITEMS)

export function toItemCatalogue(wire: WireItems): Map<Item, ItemEntry> {
  return new Map(
    Object.entries(wire).flatMap(([id, info]): [Item, ItemEntry][] =>
      known.has(id) ? [[id as Item, info]] : [],
    ),
  )
}
