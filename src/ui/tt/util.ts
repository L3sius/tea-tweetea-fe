// Shared constants for the Tt components, copied from tweetea-design-system/src/util.mjs.
import type { Gem } from '@/domain/vocabulary'

export const px = (v: number | string | undefined) => (typeof v === 'number' ? `${v}px` : v)

export const COLORS: Record<string, string> = {
  yellow: 'var(--osrs-yellow)',
  white: 'var(--osrs-white)',
  orange: 'var(--osrs-orange)',
  green: 'var(--osrs-green)',
  red: 'var(--osrs-red)',
  cash: 'var(--osrs-cash)',
  cyan: 'var(--osrs-cyan)',
  muted: 'var(--text-muted)',
}

export const FONTS: Record<string, string> = {
  small: 'var(--font-small)',
  plain: 'var(--font-plain)',
  bold: 'var(--font-bold)',
  quill: 'var(--font-quill)',
}

/** Server gem colour -> the OSRS gem its sprite shows. */
export const GEM_NAMES: Record<Gem, string> = {
  blue: 'Sapphire',
  green: 'Emerald',
  purple: 'Dragonstone',
  red: 'Ruby',
  yellow: 'Onyx',
  orange: 'Zenyte',
  pink: 'Red topaz',
  white: 'Diamond',
}

/** Display size of each icon sprite at the 3px art pixel. */
export const ICON_SIZES: Record<string, [number, number]> = {
  coins: [90, 87],
  feather: [60, 96],
  banana: [75, 69],
  'mystery-box': [78, 84],
  check: [52, 52],
  cross: [52, 52],
}

/** OSRS stack colouring: yellow under 100K, white K, green M (10M+). */
export function stack(n: number) {
  if (n >= 10_000_000) return { text: `${Math.floor(n / 1_000_000)}M`, color: 'var(--stack-high)' }
  if (n >= 100_000) return { text: `${Math.floor(n / 1000)}K`, color: 'var(--stack-mid)' }
  return { text: String(n), color: 'var(--stack-low)' }
}
