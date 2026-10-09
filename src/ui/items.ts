import { itemEntry } from '@/domain/items'
import { GEMS, NECKLACES, type Gem, type Item } from '@/domain/vocabulary'

/**
 * What an item slot shows: the catalogue's picture (OSRS Wiki), else a kit sprite, a gem for a
 * necklace, or just the item's name.
 */
export type ItemSprite = { url?: string; icon?: string; gem?: Gem }

// Kit sprites for when the catalogue has no picture or it fails to load.
const ICONS: Partial<Record<Item, string>> = {
  bronze_feather: 'feather',
  silver_feather: 'feather',
  gold_feather: 'feather',
  banana: 'banana',
}

const NECKLACE_GEMS = new Map<Item, Gem>(GEMS.map((gem) => [NECKLACES[gem], gem]))

/** The fallback without the catalogue picture. */
export function itemKitSprite(item: Item): ItemSprite {
  const icon = ICONS[item]
  if (icon) return { icon }
  const gem = NECKLACE_GEMS.get(item)
  return gem ? { gem } : {}
}

export function itemSprite(item: Item): ItemSprite {
  const url = itemEntry(item).icon
  return url ? { url } : itemKitSprite(item)
}
