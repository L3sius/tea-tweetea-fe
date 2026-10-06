const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' })

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', Infinity],
]

/** "3 min ago", "in 2 hr": coarse, for timestamps on a page that updates every few seconds. */
export function timeFrom(date: Date, now: Date): string {
  let amount = (date.getTime() - now.getTime()) / 1000
  if (Math.abs(amount) < 10) return 'just now'
  for (const [unit, size] of STEPS) {
    if (Math.abs(amount) < size) return relative.format(Math.trunc(amount), unit)
    amount /= size
  }
  return relative.format(Math.trunc(amount), 'day')
}

/** OSRS-style gp: 950, 12.5k, 2.4m, 1.1b. */
export function formatGp(value: number): string {
  const units: [number, string][] = [
    [1e9, 'b'],
    [1e6, 'm'],
    [1e3, 'k'],
  ]
  for (const [size, suffix] of units) {
    if (Math.abs(value) >= size) return `${trimZero((value / size).toFixed(1))}${suffix}`
  }
  return String(value)
}

const trimZero = (text: string) => text.replace(/\.0$/, '')
