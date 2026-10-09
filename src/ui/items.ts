import { itemEntry } from '@/domain/items'
import type { Item } from '@/domain/vocabulary'

/** What an item slot shows: the catalogue's picture (OSRS Wiki), else a kit sprite, or its name. */
export type ItemSprite = { url?: string; icon?: string }

// Kit sprites for when the catalogue has no picture or it fails to load.
const ICONS: Partial<Record<Item, string>> = {
  bronze_feather: 'feather',
  silver_feather: 'feather',
  gold_feather: 'feather',
  banana: 'banana',
}

/** The fallback without the catalogue picture. */
export function itemKitSprite(item: Item): ItemSprite {
  const icon = ICONS[item]
  return icon ? { icon } : {}
}

export function itemSprite(item: Item): ItemSprite {
  const url = itemEntry(item).icon
  return url ? { url } : itemKitSprite(item)
}
