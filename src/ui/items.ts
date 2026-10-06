import type { Gem, Item } from '@/domain/vocabulary'

/** What an item slot shows: a kit sprite, a gem (for the bells), or just the item's name. */
export type ItemSprite = { icon?: string; gem?: Gem }

// Only a few item sprites exist (wiki stand-ins); the rest show their name in the slot.
const ICONS: Partial<Record<Item, string>> = {
  owls_feather: 'feather',
  migrant_bird: 'feather',
  phoenix_feather: 'feather',
  banana_peel: 'banana',
  mystery_box: 'mystery-box',
}

export function itemSprite(item: Item): ItemSprite {
  const icon = ICONS[item]
  if (icon) return { icon }
  if (item.endsWith('_bell')) return { gem: item.slice(0, -'_bell'.length) as Gem }
  return {}
}
