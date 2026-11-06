/**
 * How many rows boxes of these widths take when they wrap, in order, into rows `width` wide with
 * `gap` between neighbours: as CSS flex-wrap lays them out. A box wider than a row gets one alone.
 */
export function wrapRows(widths: readonly number[], width: number, gap: number): number {
  let rows = 0
  let used = 0
  for (const w of widths) {
    if (rows === 0 || used + gap + w > width) {
      rows++
      used = w
    } else {
      used += gap + w
    }
  }
  return rows
}
