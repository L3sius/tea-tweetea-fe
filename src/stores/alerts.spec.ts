import { describe, expect, it } from 'vitest'
import { withAlert, type Alert } from './game'

const passing = (id: string): Alert => ({ id, title: id, text: '', tone: 'gem' })
const minigame = (id: string): Alert => ({
  id,
  title: id,
  text: '',
  tone: 'minigame',
  sticky: true,
})
const ids = (alerts: Alert[]) => alerts.map((a) => a.id)

describe('withAlert', () => {
  it('adds alerts in order', () => {
    expect(ids(withAlert([passing('a')], passing('b')))).toEqual(['a', 'b'])
  })

  it('replaces the previous minigame alert with a new one', () => {
    const list = withAlert([minigame('m1'), passing('a')], minigame('m2'))
    expect(ids(list)).toEqual(['a', 'm2'])
  })

  it('drops the oldest passing alerts, never the minigame one', () => {
    let list = [minigame('m'), passing('a'), passing('b'), passing('c')]
    list = withAlert(list, passing('d'))
    expect(ids(list)).toEqual(['m', 'b', 'c', 'd'])
  })
})
