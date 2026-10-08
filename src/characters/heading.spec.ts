import { describe, expect, it } from 'vitest'
import { HEADING, headingOf } from './heading'

describe('headingOf', () => {
  it('faces the way a move goes', () => {
    expect(headingOf(0, -1)).toBeCloseTo(HEADING.south)
    expect(headingOf(1, 0)).toBeCloseTo(HEADING.east)
    expect(headingOf(0, 1)).toBeCloseTo(HEADING.north)
    expect(headingOf(-1, 0)).toBeCloseTo(HEADING.west)
  })

  it('faces diagonals halfway between', () => {
    expect(headingOf(1, 1)).toBeCloseTo((HEADING.east + HEADING.north) / 2)
  })
})
