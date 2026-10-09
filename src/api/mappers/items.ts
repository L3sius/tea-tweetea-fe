import type { ItemCatalogue, ItemEntry } from '@/domain/items'
import { ITEMS, type Item } from '@/domain/vocabulary'
import type { WireItemInfo, WireItems } from '../wire/items'

const known = new Set<string>(ITEMS)

const toItemEntry = (wire: WireItemInfo): ItemEntry => ({
  name: wire.name,
  description: wire.description,
  icon: wire.icon,
  price: wire.price,
  freezeHours: wire.freeze_hours,
  multiplier: wire.multiplier,
})

export function toItemCatalogue(wire: WireItems): ItemCatalogue {
  return {
    items: new Map(
      Object.entries(wire.items).flatMap(([id, info]): [Item, ItemEntry][] =>
        known.has(id) ? [[id as Item, toItemEntry(info)]] : [],
      ),
    ),
    mysteryBox: toItemEntry(wire.mystery_box),
  }
}
