// Exports what the board needs to draw OSRS characters, in the game's own building blocks: every
// NPC rigged like a player, the model parts they are made of, the player skeleton, and the
// animations named in src/characters/roster.json. The browser merges and animates them like the
// game client does (src/characters/model.ts).
//
// Usage: node export.mjs [out dir]   (default public/osrs/)
//
//   index.json        { revision, npcs: [{ id, name, combat, models, recolor?, scale? }] }
//   anims.json        { "<id>": { name, ticks } }
//   models/<id>.bin   one model part
//   framemaps/<id>.bin, anims/<id>.bin
//
// The .bin layouts are documented with their encoders below and read by src/characters/assets.ts.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ConfigType, IndexType } from 'osrscachereader'
import {
  PLAYER_FRAMEMAP,
  animationNames,
  cachePath,
  framemapOf,
  openCache,
  playerRiggedNpcs,
} from './cache.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const roster = JSON.parse(readFileSync(resolve(here, '../../src/characters/roster.json'), 'utf8'))
const out = resolve(process.argv[2] ?? resolve(here, '../../public/osrs'))

/** Every animation id the roster names. */
function rosterAnimations() {
  const ids = new Set()
  for (const options of Object.values(roster.styles)) for (const { id } of options) ids.add(id)
  for (const pool of Object.values(roster.reactions)) for (const id of pool) ids.add(id)
  for (const id of roster.easterEggs.idle) ids.add(id)
  return [...ids].sort((a, b) => a - b)
}

/** A little-endian byte writer. */
class Writer {
  bytes = []
  u8(value) {
    this.bytes.push(value & 0xff)
  }
  u16(value) {
    if (value < 0 || value > 0xffff) throw new Error(`u16 out of range: ${value}`)
    this.u8(value)
    this.u8(value >> 8)
  }
  i16(value) {
    if (value < -0x8000 || value > 0x7fff) throw new Error(`i16 out of range: ${value}`)
    this.u16(value & 0xffff)
  }
  buffer() {
    return Uint8Array.from(this.bytes)
  }
}

/**
 * A model part:
 *   u16 vertexCount, u16 faceCount, u8 flags (1: has face alphas), u8 0
 *   i16 x, y, z per vertex (game space: y down, a tile is 128)
 *   u8 label per vertex (the vertex group animations move it with)
 *   u16 a, b, c per face, u16 HSL colour per face, [u8 alpha per face: 0 opaque, 255 hidden]
 */
function encodeModel(def) {
  const labels = new Uint8Array(def.vertexCount)
  def.vertexGroups.forEach((group, label) => {
    if (label > 0xff) throw new Error(`model ${def.id}: label ${label}`)
    for (const vertex of group ?? []) labels[vertex] = label
  })
  const alphas = def.faceAlphas?.length ? def.faceAlphas.map((a) => a & 0xff) : null
  const w = new Writer()
  w.u16(def.vertexCount)
  w.u16(def.faceCount)
  w.u8(alphas ? 1 : 0)
  w.u8(0)
  for (let v = 0; v < def.vertexCount; v++) {
    w.i16(def.vertexPositionsX[v])
    w.i16(def.vertexPositionsY[v])
    w.i16(def.vertexPositionsZ[v])
  }
  for (const label of labels) w.u8(label)
  for (let f = 0; f < def.faceCount; f++) {
    w.u16(def.faceVertexIndices1[f])
    w.u16(def.faceVertexIndices2[f])
    w.u16(def.faceVertexIndices3[f])
  }
  for (let f = 0; f < def.faceCount; f++) w.u16(def.faceColors[f] & 0xffff)
  if (alphas) for (let f = 0; f < def.faceCount; f++) w.u8(alphas[f] ?? 0)
  return w.buffer()
}

/**
 * A framemap (skeleton): u16 count, u8 type per entry, then per entry u8 length and the u8
 * labels of the vertex groups it moves.
 */
function encodeFramemap(framemap) {
  const w = new Writer()
  w.u16(framemap.types.length)
  for (const type of framemap.types) w.u8(type)
  for (const labels of framemap.frameMaps) {
    w.u8(labels.length)
    for (const label of labels) w.u8(label)
  }
  return w.buffer()
}

/**
 * An animation: u16 framemap, u16 frame count, then per frame u16 length in client ticks
 * (20 ms), u16 transform count, and per transform u16 framemap entry, i16 dx, dy, dz.
 */
function encodeAnimation(framemap, frames, lengths) {
  const w = new Writer()
  w.u16(framemap)
  w.u16(frames.length)
  frames.forEach((frame, i) => {
    w.u16(Math.min(lengths[i] ?? 1, 0xffff))
    // The loader leaves translatorCount at -1; the arrays hold one entry per transform.
    w.u16(frame.indexFrameIds.length)
    for (let t = 0; t < frame.indexFrameIds.length; t++) {
      w.u16(frame.indexFrameIds[t])
      w.i16(frame.translator_x[t])
      w.i16(frame.translator_y[t])
      w.i16(frame.translator_z[t])
    }
  })
  return w.buffer()
}

/** One entry per distinct look and name: many NPC ids are the same person in other places. */
function npcIndex(npcs) {
  const looks = new Map()
  for (const npc of npcs) {
    const recolor = npc.recolorToFind.flatMap((from, i) => [from, npc.recolorToReplace[i]])
    const scale = [npc.widthScale ?? 128, npc.heightScale ?? 128]
    const key = JSON.stringify([npc.name, npc.models, recolor, scale])
    if (looks.has(key)) continue
    const entry = { id: npc.id, name: npc.name, combat: npc.combatLevel, models: npc.models }
    if (recolor.length) entry.recolor = recolor
    if (scale[0] !== 128 || scale[1] !== 128) entry.scale = scale
    looks.set(key, entry)
  }
  return [...looks.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
}

function write(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
}

const path = cachePath()
const revision = Number(/rev(\d+)/.exec(basename(dirname(path)))?.[1] ?? 0) || null
console.log(`cache: ${path}`)
const cache = await openCache(path)
rmSync(out, { recursive: true, force: true })

// NPCs and the model parts they use.
const npcs = npcIndex(await playerRiggedNpcs(cache))
write(resolve(out, 'index.json'), JSON.stringify({ revision, npcs }))
const parts = new Set(npcs.flatMap((npc) => npc.models))
let partBytes = 0
for (const id of parts) {
  const bytes = encodeModel((await cache.getFile(IndexType.MODELS, id)).def)
  partBytes += bytes.length
  write(resolve(out, `models/${id}.bin`), bytes)
}
console.log(
  `${npcs.length} looks from ${parts.size} model parts (${(partBytes / 1e6).toFixed(1)} MB)`,
)

// Animations, and the skeletons they move.
const names = await animationNames(cache)
const anims = {}
const framemaps = new Set()
for (const id of rosterAnimations()) {
  const skeleton = await framemapOf(cache, id)
  if (skeleton !== PLAYER_FRAMEMAP) {
    console.warn(`  ! animation ${id} moves skeleton ${skeleton}, not the player's; skipped`)
    continue
  }
  const seq = await cache.getDef(IndexType.CONFIGS, ConfigType.SEQUENCE, id)
  const frames = await Promise.all(
    seq.frameIDs.map((frameId) => cache.getDef(IndexType.FRAMES, frameId >> 16, frameId & 0xffff)),
  )
  const framemap = frames[0].framemap
  if (!framemaps.has(framemap.id)) {
    framemaps.add(framemap.id)
    write(resolve(out, `framemaps/${framemap.id}.bin`), encodeFramemap(framemap))
  }
  write(resolve(out, `anims/${id}.bin`), encodeAnimation(framemap.id, frames, seq.frameLengths))
  const ticks = seq.frameLengths.reduce((total, length) => total + length, 0)
  anims[id] = { name: names.get(id) ?? null, ticks }
}
write(resolve(out, 'anims.json'), JSON.stringify(anims))
console.log(`${Object.keys(anims).length} animations`)
console.log(`wrote ${out}`)
process.exit(0)
