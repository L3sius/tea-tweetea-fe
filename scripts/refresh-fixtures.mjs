// Records every public endpoint of a running game API into src/api/fixtures/data/.
// Usage: npm run fixtures:refresh [-- http://localhost:8080]
import { mkdir, writeFile } from 'node:fs/promises'

const base = (process.argv[2] ?? 'http://localhost:8080').replace(/\/+$/, '')
const outDir = new URL('../src/api/fixtures/data/', import.meta.url)

async function get(path) {
  const response = await fetch(base + path)
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.json()
}

// /events pages at most 500 entries, oldest first.
async function allEvents() {
  const entries = []
  for (;;) {
    const after = entries.at(-1)?.seq ?? 0
    const page = await get(`/events?after=${after}&limit=500`)
    if (page.length === 0) return entries
    entries.push(...page)
  }
}

const files = {
  'board.json': () => get('/board'),
  'challenges.json': () => get('/challenges'),
  'items.json': () => get('/items'),
  'state.json': () => get('/state'),
  'events.json': allEvents,
  'feed.json': () => get('/feed?limit=200'),
  'stats-by-account.json': () => get('/stats?by=account'),
  'stats-by-team.json': () => get('/stats?by=team'),
  'stats-by-subject.json': () => get('/stats?by=subject'),
  'stats-by-hour.json': () => get('/stats?by=hour'),
}

await mkdir(outDir, { recursive: true })
for (const [name, load] of Object.entries(files)) {
  await writeFile(new URL(name, outDir), JSON.stringify(await load(), null, 2) + '\n')
  console.log(`wrote ${name}`)
}
