// The game's 16-bit face colours: 6 bits hue, 3 bits saturation, 7 bits lightness. The client turns
// them into RGB through a palette brightened by a gamma curve.

/** The client's palette brightness (its "brightness" setting at the darkest step). */
const BRIGHTNESS = 0.6

/** An OSRS HSL colour as sRGB, each channel 0–1. */
export function hslToRgb(hsl: number): [number, number, number] {
  const hue = ((hsl >> 10) & 63) / 64 + 0.5 / 64
  const saturation = ((hsl >> 7) & 7) / 8 + 0.5 / 8
  const lightness = (hsl & 127) / 128

  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = chroma * (1 - Math.abs(((hue * 6) % 2) - 1))
  const m = lightness - chroma / 2
  const [r, g, b] = (
    [
      [chroma, x, 0],
      [x, chroma, 0],
      [0, chroma, x],
      [0, x, chroma],
      [x, 0, chroma],
      [chroma, 0, x],
    ] as const
  )[Math.min(5, Math.floor(hue * 6))] ?? [0, 0, 0]
  return [r + m, g + m, b + m].map((c) => Math.min(1, Math.max(0, c)) ** BRIGHTNESS) as [
    number,
    number,
    number,
  ]
}
