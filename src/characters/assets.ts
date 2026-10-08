// Loads the files tools/characters/export.mjs writes: the NPC index, model parts, skeletons and
// animations. Each file is fetched once and shared by every piece that needs it. The binary layouts
// are documented with the encoders in export.mjs.
import { readConfig } from '@/config/env'
import type { Animation, Framemap, ModelPart } from './model'

/** An NPC look: one entry per distinct appearance and name. */
export type NpcLook = {
  /** The first NPC id with this look. */
  id: number
  name: string
  combat: number
  models: number[]
  /** Pairs of (from, to) HSL colours. */
  recolor?: number[]
  /** Width and height scale, 128 = as modelled. */
  scale?: [number, number]
}

export type AnimationInfo = {
  /** The game's internal name, like `human_walk_f`. */
  name: string | null
  /** One loop's length in client ticks (20 ms). */
  ticks: number
}

const base = () => readConfig().osrsAssetsUrl ?? `${import.meta.env.BASE_URL}osrs/`

async function fetchOk(path: string): Promise<Response> {
  const response = await fetch(base() + path)
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response
}

/** Memoises an async loader by key; a failed load is forgotten so it can be retried. */
function memo<K, V>(load: (key: K) => Promise<V>): (key: K) => Promise<V> {
  const loaded = new Map<K, Promise<V>>()
  return (key) => {
    let value = loaded.get(key)
    if (!value) {
      value = load(key)
      value.catch(() => loaded.delete(key))
      loaded.set(key, value)
    }
    return value
  }
}

/** Runs `load` once; a failed load is forgotten so it can be retried. */
function once<V>(load: () => Promise<V>): () => Promise<V> {
  let loaded: Promise<V> | null = null
  return () =>
    (loaded ??= load().catch((error: unknown) => {
      loaded = null
      throw error
    }))
}

export const loadNpcs = once(async () => {
  const index = (await (await fetchOk('index.json')).json()) as {
    revision: number | null
    npcs: NpcLook[]
  }
  return { ...index, byId: new Map(index.npcs.map((npc) => [npc.id, npc])) }
})

let animationInfo = new Map<number, AnimationInfo>()

export const loadAnimationInfo = once(async () => {
  const info = (await (await fetchOk('anims.json')).json()) as Record<string, AnimationInfo>
  animationInfo = new Map(Object.entries(info).map(([id, value]) => [Number(id), value]))
  return animationInfo
})

/** An animation's name and length, once `loadAnimationInfo` has finished. */
export function animationInfoOf(id: number): AnimationInfo | null {
  return animationInfo.get(id) ?? null
}

const binary = async (path: string) => new DataView(await (await fetchOk(path)).arrayBuffer())

export const loadModelPart = memo(async (id: number) =>
  decodeModelPart(await binary(`models/${id}.bin`)),
)
export const loadFramemap = memo(async (id: number) =>
  decodeFramemap(await binary(`framemaps/${id}.bin`)),
)
export const loadAnimation = memo(async (id: number) =>
  decodeAnimation(await binary(`anims/${id}.bin`)),
)

/** Reads little-endian values in order. */
class Reader {
  private at = 0
  constructor(private readonly view: DataView) {}
  u8() {
    return this.view.getUint8(this.at++)
  }
  u16() {
    const value = this.view.getUint16(this.at, true)
    this.at += 2
    return value
  }
  i16() {
    const value = this.view.getInt16(this.at, true)
    this.at += 2
    return value
  }
}

export function decodeModelPart(view: DataView): ModelPart {
  const r = new Reader(view)
  const vertexCount = r.u16()
  const faceCount = r.u16()
  const flags = r.u8()
  r.u8()
  const positions = Int16Array.from({ length: vertexCount * 3 }, () => r.i16())
  const labels = Uint8Array.from({ length: vertexCount }, () => r.u8())
  const faces = Uint16Array.from({ length: faceCount * 3 }, () => r.u16())
  const colors = Uint16Array.from({ length: faceCount }, () => r.u16())
  const alphas = flags & 1 ? Uint8Array.from({ length: faceCount }, () => r.u8()) : null
  return { positions, labels, faces, colors, alphas }
}

export function decodeFramemap(view: DataView): Framemap {
  const r = new Reader(view)
  const count = r.u16()
  const types = Uint8Array.from({ length: count }, () => r.u8())
  const groups = Array.from({ length: count }, () => {
    const length = r.u8()
    return Uint8Array.from({ length }, () => r.u8())
  })
  return { types, groups }
}

export function decodeAnimation(view: DataView): Animation {
  const r = new Reader(view)
  const framemap = r.u16()
  const frames = Array.from({ length: r.u16() }, () => {
    const ticks = r.u16()
    const count = r.u16()
    const entries = new Uint16Array(count)
    const deltas = new Int16Array(count * 3)
    for (let t = 0; t < count; t++) {
      entries[t] = r.u16()
      deltas[t * 3] = r.i16()
      deltas[t * 3 + 1] = r.i16()
      deltas[t * 3 + 2] = r.i16()
    }
    return { ticks, entries, deltas }
  })
  return { framemap, frames, ticks: frames.reduce((total, frame) => total + frame.ticks, 0) }
}
