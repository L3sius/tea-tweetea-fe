// Describes animations: the game's name for each, whether it fits the player skeleton, its frames
// and how long one loop takes.
// Usage: node describe.mjs <animation id ...>     or     node describe.mjs --search <text>
import { ConfigType, IndexType } from 'osrscachereader'
import { PLAYER_FRAMEMAP, animationNames, framemapOf, openCache } from './cache.mjs'

const TICK_MS = 20

const cache = await openCache()
const names = await animationNames(cache)
const args = process.argv.slice(2)
const ids =
  args[0] === '--search'
    ? [...names].filter(([, name]) => name.includes(args[1] ?? '')).map(([id]) => id)
    : args.map(Number)

for (const id of ids) {
  let seq
  try {
    seq = await cache.getDef(IndexType.CONFIGS, ConfigType.SEQUENCE, id)
  } catch {
    console.log(`${id}\tmissing`)
    continue
  }
  const skeleton = (await framemapOf(cache, id)) ?? 'none'
  const ticks = (seq.frameLengths ?? []).reduce((total, length) => total + length, 0)
  const fits = skeleton === PLAYER_FRAMEMAP ? 'player' : `skeleton ${skeleton}`
  const frames = seq.frameIDs?.length ?? 0
  console.log(
    `${id}\t${names.get(id) ?? '?'}\t${fits}\t${frames} frames\t${(ticks * TICK_MS) / 1000}s`,
  )
}
process.exit(0)
