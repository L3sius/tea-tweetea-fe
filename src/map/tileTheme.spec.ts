import { describe, expect, it } from 'vitest'
import { tileTheme } from './tileTheme'

describe('tileTheme', () => {
  it('frames sea tiles in waves and names the region over open water', () => {
    const theme = tileTheme({ sea: true, kind: 'normal' }, 'Morytania')
    expect(theme.environment).toBe('sea')
    expect(theme.header).toBe('open')
  })

  it('hangs a land tile’s region on cloth, in the region’s colour', () => {
    const theme = tileTheme({ sea: false, kind: 'red' }, 'Desert')
    expect(theme.environment).toBe('land')
    expect(theme.header).toBe('cloth')
    expect(theme.colour).toBe('#be2633')
    expect(theme.kind.note).toMatch(/minigame/i)
  })

  it('shows a crest for every region a continent covers, in the order it names them', () => {
    expect(tileTheme({ sea: false, kind: 'normal' }, 'Kandarin & Elven Lands').crests).toHaveLength(
      2,
    )
    expect(tileTheme({ sea: false, kind: 'normal' }, 'Wilderness & Fremenik').crests).toHaveLength(
      2,
    )
  })

  it('still draws an unknown continent, without crests', () => {
    const theme = tileTheme({ sea: false, kind: 'shop' }, 'Zanaris')
    expect(theme.crests).toEqual([])
    expect(theme.colour).toMatch(/^#/)
  })
})
