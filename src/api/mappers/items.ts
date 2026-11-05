import { readConfig } from '@/config/env'
import type { ItemCatalogue, ItemEntry } from '@/domain/items'
import { ITEMS, type Item } from '@/domain/vocabulary'
import type { WireItemInfo, WireItems } from '../wire/items'

const known = new Set<string>(ITEMS)

/** The real API, for recorded fixtures that name an icon the server hosts. */
const LIVE_API = 'https://api.tea-osrs.com'

/**
 * An icon as an address the page can load: the server hosts its own (`/icons/banana.png`), so those
 * go after the API's address; a full URL stays as it is.
 */
export function iconUrl(icon: string | null, apiBase: () => string): string | null {
  return icon?.startsWith('/') ? apiBase().replace(/\/+$/, '') + icon : icon
}

function apiBase(): string {
  const { api } = readConfig()
  return api.mode === 'http' ? api.baseUrl : LIVE_API
}

const toItemEntry = (wire: WireItemInfo): ItemEntry => ({
  name: wire.name,
  description: wire.description,
  icon: iconUrl(wire.icon, apiBase),
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
