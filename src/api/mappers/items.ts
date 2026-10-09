import type { ItemCatalogue, ItemEntry } from '@/domain/items'
import { ITEMS, type Item } from '@/domain/vocabulary'
import type { WireItems } from '../wire/items'

const known = new Set<string>(ITEMS)

export function toItemCatalogue(wire: WireItems): ItemCatalogue {
  return {
    items: new Map(
      Object.entries(wire.items).flatMap(([id, info]): [Item, ItemEntry][] =>
        known.has(id) ? [[id as Item, info]] : [],
      ),
    ),
    mysteryBox: wire.mystery_box,
  }
}
