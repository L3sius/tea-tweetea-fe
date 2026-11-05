import { describe, expect, it } from 'vitest'
import { iconUrl } from './items'

describe('iconUrl', () => {
  const base = () => 'https://api.example.test/'

  it('puts the API address in front of an icon the server hosts', () => {
    expect(iconUrl('/icons/banana.png', base)).toBe('https://api.example.test/icons/banana.png')
  })

  it('leaves a full URL, or no icon, as it is', () => {
    const wiki = 'https://oldschool.runescape.wiki/images/Banana.png'
    expect(iconUrl(wiki, base)).toBe(wiki)
    expect(iconUrl(null, base)).toBeNull()
  })
})
