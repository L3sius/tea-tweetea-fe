import { describe, expect, it } from 'vitest'
import { isMinigame } from './challenge'

describe('isMinigame', () => {
  it('knows a minigame by the tag the server gives it', () => {
    expect(isMinigame({ tags: ['minigame', 'red-tile'] })).toBe(true)
    expect(isMinigame({ tags: ['kourend', 'boss'] })).toBe(false)
    expect(isMinigame({ tags: [] })).toBe(false)
  })
})
