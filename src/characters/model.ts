// OSRS models as the game client builds and animates them: an NPC's model parts merged into one,
// recoloured, then posed frame by frame by moving labelled vertex groups. Integer maths throughout,
// like the client, so poses match the game exactly.

/** One model part, as exported by tools/characters/export.mjs. Game space: y points down. */
export type ModelPart = {
  /** x, y, z per vertex. */
  positions: Int16Array
  /** The vertex group each vertex belongs to; animations move groups by label. */
  labels: Uint8Array
  /** Three vertex indices per face. */
  faces: Uint16Array
  /** 16-bit HSL colour per face. */
  colors: Uint16Array
  /** Per face: 0 opaque … 255 hidden. Null when every face is opaque. */
  alphas: Uint8Array | null
}

/** A skeleton: what each entry of a frame does, and to which vertex groups. */
export type Framemap = {
  /** 0 sets the origin, 1 translates, 2 rotates, 3 scales, 5 changes face alpha. */
  types: Uint8Array
  /** The vertex group labels each entry moves. */
  groups: Uint8Array[]
}

export type Frame = {
  /** How long the frame shows, in client ticks (20 ms). */
  ticks: number
  /** Framemap entry per transform. */
  entries: Uint16Array
  /** dx, dy, dz per transform. */
  deltas: Int16Array
}

export type Animation = { framemap: number; frames: Frame[]; ticks: number }

export type Model = {
  vertexCount: number
  /** x, y, z per vertex at rest. */
  positions: Int32Array
  faces: Uint16Array
  colors: Uint16Array
  alphas: Uint8Array
  /** Vertex indices per group label. */
  groups: Int32Array[]
}

/**
 * Joins parts into one model, as the client does for an NPC, and applies its recolours:
 * `recolor` holds pairs of (from, to) HSL colours.
 */
export function mergeParts(parts: readonly ModelPart[], recolor: readonly number[] = []): Model {
  const vertexCount = parts.reduce((n, p) => n + p.labels.length, 0)
  const faceCount = parts.reduce((n, p) => n + p.colors.length, 0)
  const positions = new Int32Array(vertexCount * 3)
  const labels = new Uint8Array(vertexCount)
  const faces = new Uint16Array(faceCount * 3)
  const colors = new Uint16Array(faceCount)
  const alphas = new Uint8Array(faceCount)
  let v = 0
  let f = 0
  for (const part of parts) {
    positions.set(part.positions, v * 3)
    labels.set(part.labels, v)
    for (let i = 0; i < part.faces.length; i++) faces[f * 3 + i] = (part.faces[i] ?? 0) + v
    colors.set(part.colors, f)
    if (part.alphas) alphas.set(part.alphas, f)
    v += part.labels.length
    f += part.colors.length
  }
  for (let i = 0; i + 1 < recolor.length; i += 2) {
    const from = recolor[i]
    const to = recolor[i + 1] ?? 0
    for (let c = 0; c < faceCount; c++) if (colors[c] === from) colors[c] = to
  }
  return { vertexCount, positions, faces, colors, alphas, groups: groupsOf(labels) }
}

function groupsOf(labels: Uint8Array): Int32Array[] {
  const counts = new Int32Array(256)
  for (const label of labels) counts[label] = (counts[label] ?? 0) + 1
  const groups = Array.from(counts, (count) => new Int32Array(count))
  const filled = new Int32Array(256)
  labels.forEach((label, vertex) => {
    const group = groups[label]
    const slot = filled[label] ?? 0
    if (group) group[slot] = vertex
    filled[label] = slot + 1
  })
  return groups
}

/** The client's sine table: 2048 steps to a full turn, scaled by 65536. */
const SINE = Int32Array.from({ length: 2048 }, (_, i) =>
  Math.trunc(65536 * Math.sin((i * Math.PI) / 1024)),
)
const COSINE = Int32Array.from({ length: 2048 }, (_, i) =>
  Math.trunc(65536 * Math.cos((i * Math.PI) / 1024)),
)

/** The model's vertex positions in `frame` (x, y, z per vertex), written into `out`. */
export function pose(
  model: Model,
  framemap: Framemap,
  frame: Frame,
  out: Int32Array = new Int32Array(model.positions.length),
): Int32Array {
  out.set(model.positions)
  const origin = { x: 0, y: 0, z: 0 }
  for (let t = 0; t < frame.entries.length; t++) {
    const entry = frame.entries[t] ?? 0
    const labels = framemap.groups[entry]
    if (!labels) continue
    const dx = frame.deltas[t * 3] ?? 0
    const dy = frame.deltas[t * 3 + 1] ?? 0
    const dz = frame.deltas[t * 3 + 2] ?? 0
    transform(model.groups, out, framemap.types[entry] ?? -1, labels, dx, dy, dz, origin)
  }
  return out
}

type Point = { x: number; y: number; z: number }

/** One frame entry applied to the vertex groups in `labels` (the client's Model.transform). */
function transform(
  groups: Int32Array[],
  v: Int32Array,
  type: number,
  labels: Uint8Array,
  dx: number,
  dy: number,
  dz: number,
  origin: Point,
) {
  if (type === 0) return setOrigin(groups, v, labels, dx, dy, dz, origin)
  for (const label of labels) {
    const group = groups[label]
    if (!group) continue
    for (const vertex of group) {
      const i = vertex * 3
      if (type === 1) {
        v[i] = (v[i] ?? 0) + dx
        v[i + 1] = (v[i + 1] ?? 0) + dy
        v[i + 2] = (v[i + 2] ?? 0) + dz
      } else if (type === 2) rotate(v, i, dx, dy, dz, origin)
      else if (type === 3) {
        v[i] = Math.trunc((((v[i] ?? 0) - origin.x) * dx) / 128) + origin.x
        v[i + 1] = Math.trunc((((v[i + 1] ?? 0) - origin.y) * dy) / 128) + origin.y
        v[i + 2] = Math.trunc((((v[i + 2] ?? 0) - origin.z) * dz) / 128) + origin.z
      }
      // Type 5 fades faces; the board doesn't animate transparency.
    }
  }
}

/** The pivot for the rotations and scales that follow: the groups' centre, offset by d. */
function setOrigin(
  groups: Int32Array[],
  v: Int32Array,
  labels: Uint8Array,
  dx: number,
  dy: number,
  dz: number,
  origin: Point,
) {
  let count = 0
  let x = 0
  let y = 0
  let z = 0
  for (const label of labels) {
    for (const vertex of groups[label] ?? []) {
      x += v[vertex * 3] ?? 0
      y += v[vertex * 3 + 1] ?? 0
      z += v[vertex * 3 + 2] ?? 0
      count++
    }
  }
  origin.x = count > 0 ? dx + Math.trunc(x / count) : dx
  origin.y = count > 0 ? dy + Math.trunc(y / count) : dy
  origin.z = count > 0 ? dz + Math.trunc(z / count) : dz
}

/** Turns a vertex about the origin: roll (z), then pitch (x), then yaw (y), in 2048ths of a turn. */
function rotate(v: Int32Array, i: number, dx: number, dy: number, dz: number, origin: Point) {
  let x = (v[i] ?? 0) - origin.x
  let y = (v[i + 1] ?? 0) - origin.y
  let z = (v[i + 2] ?? 0) - origin.z
  const pitch = (dx & 255) * 8
  const yaw = (dy & 255) * 8
  const roll = (dz & 255) * 8
  if (roll !== 0) {
    const sin = SINE[roll] ?? 0
    const cos = COSINE[roll] ?? 0
    const nx = (sin * y + cos * x) >> 16
    y = (cos * y - sin * x) >> 16
    x = nx
  }
  if (pitch !== 0) {
    const sin = SINE[pitch] ?? 0
    const cos = COSINE[pitch] ?? 0
    const ny = (cos * y - sin * z) >> 16
    z = (sin * y + cos * z) >> 16
    y = ny
  }
  if (yaw !== 0) {
    const sin = SINE[yaw] ?? 0
    const cos = COSINE[yaw] ?? 0
    const nx = (sin * z + cos * x) >> 16
    z = (cos * z - sin * x) >> 16
    x = nx
  }
  v[i] = x + origin.x
  v[i + 1] = y + origin.y
  v[i + 2] = z + origin.z
}

/** Which frame of `animation` shows `ticks` client ticks in, looping. */
export function frameAt(animation: Animation, ticks: number): number {
  if (animation.ticks <= 0) return 0
  let t = ((ticks % animation.ticks) + animation.ticks) % animation.ticks
  for (let i = 0; i < animation.frames.length; i++) {
    t -= animation.frames[i]?.ticks ?? 0
    if (t < 0) return i
  }
  return animation.frames.length - 1
}
