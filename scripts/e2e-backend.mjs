// Runs the tweety game API for the end-to-end tests (Playwright starts this; see playwright.config.ts).
// Every reset starts tweety again on an empty database, so each test seeds its own game.
//
// The API listens on 8090 and a small control server on 8091: POST /reset gives a fresh game,
// GET /health answers once the API is up. Neither touches a play-testing server on 8080.
// Without a tweety checkout only the control server runs, and /reset says why the live tests skip.
// TWEETY_DIR says where the tweety checkout is (default: ../tweety next to this repo).
import { spawn, spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const API_PORT = 8090
export const CONTROL_PORT = 8091
const VITE_ORIGIN = 'http://localhost:5175'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tweety = resolve(process.env.TWEETY_DIR ?? join(repo, '..', 'tweety'))
const exe = join(
  tweety,
  'target',
  'release',
  process.platform === 'win32' ? 'tweety.exe' : 'tweety',
)
const work = join(tmpdir(), 'tweetea-e2e')

/** Why there is no API to test against, if there isn't. */
let missing = null

function fail(message) {
  console.error(`e2e backend: ${message}`)
  process.exit(1)
}

function newestIn(path) {
  const stat = statSync(path)
  if (!stat.isDirectory()) return stat.mtimeMs
  return Math.max(0, ...readdirSync(path).map((name) => newestIn(join(path, name))))
}

/** Builds tweety when the exe is missing or older than its sources. */
function build() {
  const sources = ['src', 'Cargo.toml', 'Cargo.lock'].map((p) => join(tweety, p)).filter(existsSync)
  if (existsSync(exe) && statSync(exe).mtimeMs >= Math.max(...sources.map(newestIn))) return
  console.log('e2e backend: building tweety (cargo build --release)...')
  const built = spawnSync('cargo', ['build', '--release', '--bin', 'tweety'], {
    cwd: tweety,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (built.status === 0) return
  // On Windows a running tweety (the play-testing server) locks the exe, so the build can't replace it.
  if (existsSync(exe)) console.warn('e2e backend: the build failed; using the existing tweety exe.')
  else fail('cargo build failed, and there is no tweety exe to use.')
}

/**
 * Copies tweety's sample config. With core.symlinks=false a symlinked file checks out as a text
 * file holding its target's path, so those are replaced by the target.
 */
function copyConfig(to) {
  const from = join(tweety, 'config', 'sample')
  rmSync(to, { recursive: true, force: true })
  cpSync(from, to, { recursive: true, dereference: true })
  const listed = spawnSync('git', ['ls-files', '-s', 'config/sample'], {
    cwd: tweety,
    encoding: 'utf8',
  })
  for (const line of listed.stdout.split('\n')) {
    const [meta, path] = line.split('\t')
    if (!meta?.startsWith('120000') || !path) continue
    const link = join(tweety, path)
    if (lstatSync(link).isSymbolicLink()) continue
    const target = resolve(dirname(link), readFileSync(link, 'utf8').trim())
    cpSync(target, join(to, path.slice('config/sample/'.length)))
  }
}

let api = null

async function stopApi() {
  const running = api
  api = null
  if (!running || running.exitCode !== null) return
  const exited = new Promise((done) => running.once('exit', done))
  running.kill()
  await exited
}

async function startApi() {
  await stopApi()
  // A fresh, empty database. The -wal and -shm files go too, or SQLite replays the old journal.
  for (const suffix of ['', '-wal', '-shm']) rmSync(join(work, `e2e.db${suffix}`), { force: true })
  api = spawn(exe, [], {
    cwd: work,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: {
      ...process.env,
      CONFIG_DIR: 'config',
      DATABASE_URL: 'sqlite://e2e.db',
      ADMIN_CODE: 'admin',
      DINK_TOKEN: '',
      CORS_ORIGINS: VITE_ORIGIN,
      BIND: `127.0.0.1:${API_PORT}`,
      DEV_TOOLS: '1',
      RUST_LOG: process.env.RUST_LOG ?? 'warn',
    },
  })
  const started = api
  for (let waited = 0; waited < 30_000; waited += 100) {
    if (started.exitCode !== null) throw new Error(`tweety exited with code ${started.exitCode}`)
    try {
      if ((await fetch(`http://127.0.0.1:${API_PORT}/rules`)).ok) return
    } catch {
      // Not listening yet.
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('tweety did not answer within 30 s')
}

if (existsSync(tweety)) {
  build()
  mkdirSync(work, { recursive: true })
  copyConfig(join(work, 'config'))
  await startApi().catch((e) => fail(e.message))
} else {
  missing = `no tweety checkout at ${tweety}; set TWEETY_DIR to run the live tests`
  console.warn(`e2e backend: ${missing}`)
}

// Resets queue up, so two never restart tweety at once.
let queue = Promise.resolve()
createServer((req, res) => {
  const reply = (status, text) => res.writeHead(status, { 'Content-Type': 'text/plain' }).end(text)
  if (req.method === 'GET' && req.url === '/health') return reply(200, missing ?? 'up')
  if (req.method === 'POST' && req.url === '/reset') {
    if (missing) return reply(503, missing)
    queue = queue.then(() =>
      startApi().then(
        () => reply(200, 'reset'),
        (e) => reply(500, String(e.message)),
      ),
    )
    return
  }
  reply(404, 'not found')
}).listen(CONTROL_PORT, '127.0.0.1', () =>
  console.log(`e2e backend: tweety on :${API_PORT}, control on :${CONTROL_PORT}`),
)

for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => void stopApi().then(() => process.exit(0)))
process.on('exit', () => api?.kill())
