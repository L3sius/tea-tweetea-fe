// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useDinkStore } from './dink'

beforeEach(() => setActivePinia(createPinia()))
afterEach(() => localStorage.clear())

describe('dink setup', () => {
  it('opens and closes from the header without counting as set up', () => {
    const dink = useDinkStore()
    dink.show()
    expect(dink.shown).toBe(true)
    dink.hide()
    expect(dink.shown).toBe(false)
    expect(dink.done).toBe(false)
  })

  it('remembers "set up" after a reload', () => {
    const first = useDinkStore()
    first.show()
    first.confirm()
    expect(first.shown).toBe(false)

    setActivePinia(createPinia())
    expect(useDinkStore().done).toBe(true)
  })
})
