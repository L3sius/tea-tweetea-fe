// Cuts the tutorial recording into one clip per chatbox line, for the tour to play as each line
// appears. The words (from transcribe.py) say which stretch of the recording is which line; each
// cut lands in the pause between two lines. Every clip gets the same gain, so the take keeps its
// natural level, with its loudest moment at the sound effects' -16 LUFS (docs/sounds.md).
//
// Usage: node tools/voice/split.mjs [recording] [words.json]
//   (defaults: tools/voice/tutorial-raw.mp3 and tools/voice/tutorial-words.json)
//
// Writes public/voice/tutorial/<beat>-<line>.ogg and src/tutorial/voice.json, which lists each
// clip's length and the text that was recorded (script.spec.ts checks the script still says it).
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TUTORIAL } from '../../src/tutorial/script.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const recording = resolve(root, process.argv[2] ?? 'tools/voice/tutorial-raw.mp3')
const words = JSON.parse(
  readFileSync(resolve(root, process.argv[3] ?? 'tools/voice/tutorial-words.json'), 'utf8'),
)
const outDir = resolve(root, 'public/voice/tutorial')
const manifest = resolve(root, 'src/tutorial/voice.json')

/** The loudest moment of every clip together, as for the sound effects. */
const TARGET_MAX_MOMENTARY = -16
/** Pauses shorter than this are breaths inside a sentence, not between lines. */
const MIN_PAUSE_S = 0.15
/** Kept on either side of the speech, so a cut never clips a soft first or last sound. */
const LEAD_S = 0.08
const TAIL_S = 0.12

/** Runs ffmpeg and returns its log, which it writes to stderr even when all goes well. */
function ffmpeg(args) {
  const run = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (run.status !== 0) throw new Error(`ffmpeg failed: ${run.stderr}`)
  return run.stderr
}
/** Reads the recording through a filter, for what it measures. */
const analyse = (filter) =>
  ffmpeg(['-v', 'verbose', '-i', recording, '-af', filter, '-f', 'null', '-'])

const letters = (text) => text.toLowerCase().replace(/[^a-z]/g, '')

// --- Which words are which line ---

const lines = TUTORIAL.flatMap((beat) =>
  beat.lines.map((line, i) => ({ id: `${beat.id}-${i + 1}`, text: line.text })),
)
let w = 0
const spans = lines.map((line) => {
  const want = letters(line.text)
  const first = w
  let heard = ''
  while (w < words.length && heard.length < want.length) heard += letters(words[w++].w)
  // The recognizer spells names its own way ("Tweetya"), so compare loosely: the length, and how
  // the line starts and ends.
  const close =
    Math.abs(heard.length - want.length) <= 2 &&
    heard.slice(0, 4) === want.slice(0, 4) &&
    heard.slice(-4) === want.slice(-4)
  if (!close) throw new Error(`${line.id}: the recording says "${heard}", the script "${want}"`)
  return { ...line, start: words[first].start, end: words[w - 1].end }
})
if (w < words.length)
  throw new Error(`the recording goes on after the last line: ${words.slice(w).map((x) => x.w)}`)

// --- Where to cut: the pause between one line's last word and the next one's first ---

const silences = [
  ...analyse(`silencedetect=noise=-40dB:d=${MIN_PAUSE_S}`).matchAll(
    /silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g,
  ),
].map((m) => ({ start: Number(m[1]), end: Number(m[2]) }))

const duration = Number(
  execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', recording],
    { encoding: 'utf8' },
  ),
)

const cuts = spans.map((span) => ({ ...span, from: span.start - LEAD_S, to: span.end + TAIL_S }))
for (let i = 0; i < cuts.length - 1; i++) {
  const a = cuts[i]
  const b = cuts[i + 1]
  // Word times are only roughly right, so look a little either side of the gap.
  const pause = silences
    .filter((s) => s.end > a.end - 0.25 && s.start < b.start + 0.25)
    .sort((x, y) => y.end - y.start - (x.end - x.start))[0]
  if (pause) {
    a.to = Math.min(pause.end, pause.start + TAIL_S)
    b.from = Math.max(pause.start, pause.end - LEAD_S)
  } else {
    const middle = (a.end + b.start) / 2
    a.to = middle
    b.from = middle
    console.warn(`no pause found between ${a.id} and ${b.id}; cut at ${middle.toFixed(2)} s`)
  }
}
cuts[0].from = Math.max(0, cuts[0].from)
cuts.at(-1).to = Math.min(duration, cuts.at(-1).to)

// --- One gain for the whole take ---

const momentary = [...analyse('ebur128=framelog=verbose').matchAll(/ M: *(-?[\d.]+)/g)]
  .map((m) => Number(m[1]))
  .filter(Number.isFinite)
if (momentary.length === 0) throw new Error('ffmpeg measured no loudness')
const gain = TARGET_MAX_MOMENTARY - Math.max(...momentary)

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
const voice = {}
for (const cut of cuts) {
  const length = cut.to - cut.from
  const out = resolve(outDir, `${cut.id}.ogg`)
  // Short fades so a cut never clicks; the levelled clip is mono Ogg Vorbis, like the effects.
  ffmpeg([
    '-ss',
    cut.from.toFixed(3),
    '-to',
    cut.to.toFixed(3),
    '-i',
    recording,
    '-af',
    `volume=${gain.toFixed(2)}dB,afade=t=in:d=0.01,afade=t=out:st=${(length - 0.04).toFixed(3)}:d=0.04`,
    '-ac',
    '1',
    '-c:a',
    'libvorbis',
    '-q:a',
    '3',
    '-y',
    out,
  ])
  voice[cut.id] = { text: cut.text, ms: Math.round(length * 1000) }
  console.log(
    `${cut.id.padEnd(12)} ${cut.from.toFixed(2).padStart(7)} -> ${cut.to.toFixed(2).padStart(7)}  ${length.toFixed(2)} s  ${cut.text.slice(0, 50)}`,
  )
}
writeFileSync(manifest, JSON.stringify(voice, null, 2) + '\n')
console.log(`\n${cuts.length} clips at ${gain.toFixed(1)} dB into ${outDir}`)
