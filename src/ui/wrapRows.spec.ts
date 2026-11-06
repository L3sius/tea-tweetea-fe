import { describe, expect, it } from 'vitest'
import { wrapRows } from './wrapRows'

describe('wrapRows', () => {
  it('counts the rows that wrapping boxes take', () => {
    expect(wrapRows([], 100, 4)).toBe(0)
    expect(wrapRows([48, 48], 100, 4)).toBe(1)
    expect(wrapRows([48, 49], 100, 4)).toBe(2)
    expect(wrapRows([60, 30, 30, 90], 100, 4)).toBe(3)
  })

  it('gives a box wider than a row a row of its own', () => {
    expect(wrapRows([150, 20], 100, 4)).toBe(2)
  })
})
