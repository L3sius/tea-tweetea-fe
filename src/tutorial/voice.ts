// Which chatbox lines have Earl Grey's voice: tools/voice/split.mjs writes voice.json from the
// recording, with the text each clip says.
import recorded from './voice.json'

/** A recorded line: its clip (see sound/voice.ts) and how long it plays. */
export type Voiced = { clip: string; ms: number }

const clips: Record<string, { text: string; ms: number } | undefined> = recorded

/** The clip for line `index` of beat `beatId`; none once the line says something else. */
export function voiceOf(beatId: string, index: number, text: string): Voiced | null {
  const clip = `${beatId}-${index + 1}`
  const found = clips[clip]
  return found && found.text === text ? { clip, ms: found.ms } : null
}
