// Which way a piece faces on the ground, as a turn (radians) from facing the viewer. Models face
// the viewer (south) as baked; a quarter turn faces east.

export const HEADING = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 } as const

/** The heading of a move `east` and `north` world tiles long. */
export function headingOf(east: number, north: number): number {
  return Math.atan2(east, -north)
}
