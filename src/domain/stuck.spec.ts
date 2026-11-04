import { describe, expect, it } from 'vitest'
import { holdsTeams, stuckCallout, stuckCause, stuckState } from './stuck'

describe('stuck', () => {
  it('words each item that holds a team in its own way', () => {
    expect(stuckCallout('banana')).toBe('Slipped!')
    expect(stuckState('banana')).toBe('Floored')
    expect(stuckCallout('snake_charmer')).toBe('Charmed!')
    expect(stuckState('ice_barrage')).toBe('Frozen')
  })

  it('calls a freeze without an item, or with an item that does not freeze, stuck', () => {
    expect(stuckCause(null)).toBe('other')
    expect(stuckCause('bronze_feather')).toBe('other')
    expect(stuckState(null)).toBe('Stuck')
  })

  it('knows which items hold teams', () => {
    expect(holdsTeams('entangle')).toBe(true)
    expect(holdsTeams('wilderness_web')).toBe(true)
    expect(holdsTeams('morrigans_throwing_axe')).toBe(false)
    expect(holdsTeams(null)).toBe(false)
  })
})
