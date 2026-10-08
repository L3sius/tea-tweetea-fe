import { describe, expect, it } from 'vitest'
import { frameAt, mergeParts, pose, type Frame, type Framemap, type ModelPart } from './model'

type Quad = [number, number, number, number]

/** A part from vertices [x, y, z, label] and faces [a, b, c, colour]. */
function part(vertices: Quad[], faces: Quad[] = []): ModelPart {
  return {
    positions: Int16Array.from(vertices.flatMap(([x, y, z]) => [x, y, z])),
    labels: Uint8Array.from(vertices.map((v) => v[3])),
    faces: Uint16Array.from(faces.flatMap(([a, b, c]) => [a, b, c])),
    colors: Uint16Array.from(faces.map((f) => f[3])),
    alphas: null,
  }
}

const frame = (...transforms: [entry: number, dx: number, dy: number, dz: number][]): Frame => ({
  ticks: 1,
  entries: Uint16Array.from(transforms.map((t) => t[0])),
  deltas: Int16Array.from(transforms.flatMap((t) => [t[1], t[2], t[3]])),
})

/** Entry 0 sets the origin from group 1; 1 translates, 2 rotates, 3 scales group 1. */
const skeleton: Framemap = {
  types: Uint8Array.from([0, 1, 2, 3]),
  groups: [1, 1, 1, 1].map((g) => Uint8Array.from([g])),
}

describe('mergeParts', () => {
  it('joins parts, renumbering faces and keeping each vertex group', () => {
    const model = mergeParts([
      part(
        [
          [0, 0, 0, 0],
          [1, 0, 0, 1],
          [0, 1, 0, 1],
        ],
        [[0, 1, 2, 100]],
      ),
      part(
        [
          [5, 5, 5, 1],
          [6, 5, 5, 2],
          [5, 6, 5, 0],
        ],
        [[0, 1, 2, 200]],
      ),
    ])
    expect(model.vertexCount).toBe(6)
    expect([...model.faces]).toEqual([0, 1, 2, 3, 4, 5])
    expect([...(model.groups[1] ?? [])]).toEqual([1, 2, 3])
    expect([...(model.groups[0] ?? [])]).toEqual([0, 5])
  })

  it('applies recolours', () => {
    const model = mergeParts(
      [
        part(
          [[0, 0, 0, 0]],
          [
            [0, 0, 0, 100],
            [0, 0, 0, 7],
          ],
        ),
      ],
      [100, 300],
    )
    expect([...model.colors]).toEqual([300, 7])
  })
})

describe('pose', () => {
  const model = mergeParts([
    part([
      [10, 0, 0, 1],
      [-10, 0, 0, 1],
      [0, 0, 0, 0],
    ]),
  ])

  it('moves only the labelled groups', () => {
    expect([...pose(model, skeleton, frame([1, 5, -3, 2]))]).toEqual([
      15, -3, 2, -5, -3, 2, 0, 0, 0,
    ])
  })

  it('turns about the origin in 2048ths of a turn, 8 per step', () => {
    // A yaw of 64 steps is 512/2048, a quarter turn: x swings onto z.
    const turned = pose(model, skeleton, frame([0, 0, 0, 0], [2, 0, 64, 0]))
    expect(turned[0]).toBeCloseTo(0, -1)
    expect(Math.abs(turned[2] ?? 0)).toBeGreaterThanOrEqual(9)
  })

  it('scales about the origin, 128 meaning as modelled', () => {
    const scaled = pose(model, skeleton, frame([0, 0, 0, 0], [3, 256, 128, 128]))
    expect([scaled[0], scaled[3]]).toEqual([20, -20])
  })

  it('leaves the model itself untouched', () => {
    pose(model, skeleton, frame([1, 5, 5, 5]))
    expect([...model.positions]).toEqual([10, 0, 0, -10, 0, 0, 0, 0, 0])
  })
})

describe('frameAt', () => {
  const animation = {
    framemap: 0,
    frames: [3, 1, 2].map((ticks) => ({ ...frame(), ticks })),
    ticks: 6,
  }

  it('finds the frame a tick falls in, looping', () => {
    expect([0, 2, 3, 4, 5, 6, 9].map((t) => frameAt(animation, t))).toEqual([0, 0, 1, 2, 2, 0, 1])
  })
})
