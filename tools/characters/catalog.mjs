// Lists the NPCs rigged like a player, so any human animation plays on them: those whose idle
// animation moves the player's framemap (skeleton).
// Usage: node catalog.mjs  →  out/human-npcs.tsv
import { mkdirSync, writeFileSync } from 'node:fs'
import { cachePath, openCache, playerRiggedNpcs } from './cache.mjs'

const path = cachePath()
const npcs = await playerRiggedNpcs(await openCache(path))
const rows = npcs
  .map((npc) => [
    npc.id,
    npc.name,
    npc.combatLevel,
    npc.size,
    npc.standingAnimation,
    npc.walkingAnimation,
    npc.models.join(','),
  ])
  .sort((a, b) => String(a[1]).localeCompare(String(b[1])) || a[0] - b[0])

const header = ['npc', 'name', 'combat', 'size', 'idle', 'walk', 'models']
mkdirSync(new URL('./out/', import.meta.url), { recursive: true })
const out = new URL('./out/human-npcs.tsv', import.meta.url)
writeFileSync(out, [header, ...rows].map((row) => row.join('\t')).join('\n') + '\n')
console.log(`${rows.length} NPCs rigged like a player`)
console.log(`cache: ${path}`)
console.log(`wrote ${out.pathname}`)
process.exit(0)
