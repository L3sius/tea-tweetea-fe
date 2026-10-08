import { describe, expect, it } from 'vitest'
import { toMe } from './server'

describe('toMe', () => {
  it('turns the private inventory into a map', () => {
    const me = toMe({ team: 0, name: 'Red', items: { bronze_feather: 2, banana: 1 }, seq: 42 })
    expect(me).toEqual({
      teamId: 0,
      name: 'Red',
      items: new Map([
        ['bronze_feather', 2],
        ['banana', 1],
      ]),
      seq: 42,
    })
  })
})
