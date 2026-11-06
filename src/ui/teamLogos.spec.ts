import { describe, expect, it } from 'vitest'
import { teamLogo } from './teamLogos'

describe('teamLogo', () => {
  it('finds a team by its name', () => {
    expect(teamLogo({ name: "Eve's Big Gems" })).toBe('/teams/ebg.webp')
    expect(teamLogo({ name: " Dhilly's Dirty Diamonds " })).toBe('/teams/ddd.webp')
  })

  it('gives no logo to a team without one', () => {
    expect(teamLogo({ name: 'Team Oathless' })).toBeNull()
  })
})
