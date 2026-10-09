import { describe, expect, it } from 'vitest'
import { count } from './format'

describe('count', () => {
  it('says the noun in the plural unless there is one', () => {
    expect(count(1, 'tile')).toBe('1 tile')
    expect(count(0, 'tile')).toBe('0 tiles')
    expect(count(4, 'tile')).toBe('4 tiles')
  })
})
