// Opens an OSRS cache with osrscachereader, patched for the caches it doesn't read yet.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ConfigType, IndexType, RSCache } from 'osrscachereader'
// The package only exports its index, so these are reached by path.
import Index from './node_modules/osrscachereader/src/cacheReader/cacheTypes/Index.js'
import NpcLoader from './node_modules/osrscachereader/src/cacheReader/loaders/NpcLoader.js'

// Since rev 233 NPCs list their models as 4-byte ids under opcodes 61 (body) and 62 (chathead)
// instead of 2-byte ids under 1 and 60. osrscachereader 1.1.3 stops at the old opcodes, so newer
// NPCs come out with no models.
// It also stores opcode 97 (width scale) on the loader instead of the NPC.
const handleOpcode = NpcLoader.prototype.handleOpcode
NpcLoader.prototype.handleOpcode = function (def, opcode, data) {
  if (opcode === 97) {
    def.widthScale = data.readUint16()
    return
  }
  if (opcode !== 61 && opcode !== 62) return handleOpcode.call(this, def, opcode, data)
  const count = data.readUint8()
  const ids = Array.from({ length: count }, () => data.readInt32())
  if (opcode === 61) def.models = ids
  else def.chatheadModels = ids
}

/** `OSRS_CACHE`, or else the newest cache qodat has downloaded. */
export function cachePath() {
  if (process.env.OSRS_CACHE) return process.env.OSRS_CACHE
  const downloads = join(homedir(), '.qodat', 'downloads')
  const newest = existsSync(downloads)
    ? readdirSync(downloads)
        .filter((dir) => existsSync(join(downloads, dir, 'cache', 'main_file_cache.dat2')))
        .sort()
        .at(-1)
    : undefined
  if (!newest)
    throw new Error('No cache found: set OSRS_CACHE to a folder with main_file_cache.dat2')
  return join(downloads, newest, 'cache')
}

export async function openCache(path = cachePath()) {
  const cache = new RSCache(path.endsWith('/') ? path : path + '/')
  await cache.onload
  cache.path = path.endsWith('/') ? path : path + '/'
  return cache
}

/** Gamevals (index 24, rev 230+): the game's internal names. Table 7 names animations. */
const GAMEVALS = 24
const SEQUENCE_NAMES = 7

/**
 * The game's own name for every animation, like `human_walk_f` for 819. osrscachereader only
 * opens indices 0–22, so the gamevals index is mounted here by hand. Empty for older caches.
 */
export async function animationNames(cache) {
  const file = (name) => {
    const bytes = readFileSync(cache.path + name)
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.length)
  }
  if (!existsSync(cache.path + `main_file_cache.idx${GAMEVALS}`)) return new Map()
  const u24 = (view, at) => (view.getUint16(at) << 8) | view.getUint8(at + 2)
  const segments = file(`main_file_cache.idx${GAMEVALS}`)
  const index = new Index(GAMEVALS)
  for (let at = 0; at + 6 <= segments.byteLength; at += 6)
    index.indexSegments.push({ size: u24(segments, at), segment: u24(segments, at + 3) })
  cache.indicies[GAMEVALS] = index

  const reference = file('main_file_cache.idx255')
  const at = GAMEVALS * 6
  if (reference.byteLength < at + 6) return new Map()
  const table = await cache.cacheRequester.readData(
    index,
    u24(reference, at),
    u24(reference, at + 3),
  )
  index.loadIndexData(table.decompressedData)

  const files = await cache.getAllFiles(GAMEVALS, SEQUENCE_NAMES)
  const decoder = new TextDecoder('latin1')
  return new Map(files.filter(Boolean).map((f) => [f.id, decoder.decode(f.content)]))
}

/** The framemap (skeleton) of the player's own animations. */
export const PLAYER_FRAMEMAP = 0

/**
 * The framemap an animation moves, `'skeletal'` for the newer skeletal (maya) animations, or null
 * when it has no frames.
 */
export async function framemapOf(cache, animationId) {
  try {
    const seq = await cache.getDef(IndexType.CONFIGS, ConfigType.SEQUENCE, animationId)
    if (seq.animMayaID > 0) return 'skeletal'
    const frame = seq.frameIDs?.[0]
    if (frame === undefined) return null
    const def = await cache.getDef(IndexType.FRAMES, frame >> 16, frame & 0xffff)
    return def?.framemap?.id ?? null
  } catch {
    return null
  }
}

/** Every NPC rigged like a player: its idle animation moves the player's framemap. */
export async function playerRiggedNpcs(cache) {
  const npcs = await cache.getAllDefs(IndexType.CONFIGS, ConfigType.NPC)
  const rigged = []
  for (const npc of npcs) {
    if (!npc?.name || npc.name === 'null' || !npc.models.length || npc.standingAnimation <= 0)
      continue
    if ((await framemapOf(cache, npc.standingAnimation)) === PLAYER_FRAMEMAP) rigged.push(npc)
  }
  return rigged
}
