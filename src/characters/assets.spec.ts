import { describe, expect, it } from 'vitest'
import { decodeAnimation, decodeFramemap, decodeModelPart } from './assets'

/** Little-endian bytes from [kind, value] pairs. */
function bytes(...values: ['u8' | 'u16' | 'i16', number][]): DataView {
  const size = values.reduce((n, [kind]) => n + (kind === 'u8' ? 1 : 2), 0)
  const view = new DataView(new ArrayBuffer(size))
  let at = 0
  for (const [kind, value] of values) {
    if (kind === 'u8') view.setUint8(at++, value)
    else {
      if (kind === 'u16') view.setUint16(at, value, true)
      else view.setInt16(at, value, true)
      at += 2
    }
  }
  return view
}

describe('decoding the exported files', () => {
  it('reads a model part', () => {
    const part = decodeModelPart(
      bytes(
        ['u16', 3],
        ['u16', 1],
        ['u8', 1],
        ['u8', 0],
        ['i16', 1],
        ['i16', -2],
        ['i16', 3],
        ['i16', 4],
        ['i16', 5],
        ['i16', 6],
        ['i16', 7],
        ['i16', 8],
        ['i16', -9],
        ['u8', 0],
        ['u8', 1],
        ['u8', 2],
        ['u16', 0],
        ['u16', 1],
        ['u16', 2],
        ['u16', 43072],
        ['u8', 255],
      ),
    )
    expect([...part.positions]).toEqual([1, -2, 3, 4, 5, 6, 7, 8, -9])
    expect([...part.labels]).toEqual([0, 1, 2])
    expect([...part.faces]).toEqual([0, 1, 2])
    expect([...part.colors]).toEqual([43072])
    expect([...(part.alphas ?? [])]).toEqual([255])
  })

  it('reads a skeleton', () => {
    const framemap = decodeFramemap(
      bytes(
        ['u16', 2],
        ['u8', 0],
        ['u8', 2],
        ['u8', 1],
        ['u8', 7],
        ['u8', 2],
        ['u8', 3],
        ['u8', 4],
      ),
    )
    expect([...framemap.types]).toEqual([0, 2])
    expect(framemap.groups.map((g) => [...g])).toEqual([[7], [3, 4]])
  })

  it('reads an animation and adds up its length', () => {
    const animation = decodeAnimation(
      bytes(
        ['u16', 0],
        ['u16', 2],
        ['u16', 4],
        ['u16', 1],
        ['u16', 3],
        ['i16', -1],
        ['i16', 2],
        ['i16', -3],
        ['u16', 6],
        ['u16', 0],
      ),
    )
    expect(animation.ticks).toBe(10)
    expect([...(animation.frames[0]?.entries ?? [])]).toEqual([3])
    expect([...(animation.frames[0]?.deltas ?? [])]).toEqual([-1, 2, -3])
    expect(animation.frames[1]?.entries.length).toBe(0)
  })
})
