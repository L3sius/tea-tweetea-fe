// The tour's chapters (its beats): where each one starts, worked out from the script alone, so the
// contents can jump to any chapter and leave the page as playing up to it would have.
import { TOUR_START, TUTORIAL, type Action, type Beat, type RevealName } from './script'

/** A beat's actions in the order they play: its own cues, then each line's, by time. */
export function actionsOf(beat: Beat): Action[] {
  const byTime = (cues: Beat['cues'] = []) =>
    [...cues].sort((a, b) => a.at - b.at).map((c) => c.action)
  return [...byTime(beat.cues), ...beat.lines.flatMap((line) => byTime(line.cues))]
}

export type ChapterStart = {
  /** The parts of the page the chapters before it revealed. */
  revealed: Set<RevealName>
  /** Where Earl Grey stands (a tile of the tutorial's board). */
  tile: number
  /** Whether his minigame has opened. */
  minigameOpen: boolean
}

/** How the page stands as chapter `index` begins. */
export function chapterStart(index: number): ChapterStart {
  const start: ChapterStart = { revealed: new Set(), tile: TOUR_START, minigameOpen: false }
  for (const action of TUTORIAL.slice(0, index).flatMap(actionsOf)) {
    if (action.kind === 'reveal') action.what.forEach((part) => start.revealed.add(part))
    if (action.kind === 'walk') start.tile = action.path.at(-1) ?? start.tile
    if (action.kind === 'spin') start.minigameOpen = true
  }
  return start
}
