import { describe, expect, it } from 'vitest'
import { ROSTER } from '@/characters/roster'
import { tileId, type TileId } from '@/domain/ids'
import { GUIDE } from './guide'
import { GESTURE, TOUR_START, TUTORIAL, type Action } from './script'
import { decodeTutorialWorld } from './world'
import board from './world/board.json'
import challenges from './world/challenges.json'
import state from './world/state.json'

const world = decodeTutorialWorld({ board, state, challenges })

/** Every action in the order the tour plays it: each beat's cues, then each line's, by time. */
function actionsInOrder(): Action[] {
  const byTime = (cues: { at: number; action: Action }[] = []) =>
    [...cues].sort((a, b) => a.at - b.at).map((c) => c.action)
  return TUTORIAL.flatMap((beat) => [
    ...byTime(beat.cues),
    ...beat.lines.flatMap((line) => byTime(line.cues)),
  ])
}

describe('the tutorial script', () => {
  it("only uses animations the export ships (it ships the roster's)", () => {
    const shipped = new Set([
      ...Object.values(ROSTER.styles).flatMap((options) => options.map((o) => o.id)),
      ...Object.values(ROSTER.reactions).flat(),
      ...ROSTER.easterEggs.idle,
    ])
    const used = [...Object.values(GESTURE), GUIDE.idle, GUIDE.walk, GUIDE.run]
    expect(used.filter((id) => !shipped.has(id))).toEqual([])
  })

  it('gives every beat something to say', () => {
    expect(TUTORIAL.every((beat) => beat.lines.length > 0)).toBe(true)
  })
})

describe("Earl Grey's routes on the tutorial's board", () => {
  const roads = new Set(world.board.roads.flatMap(([a, b]) => [`${a}-${b}`, `${b}-${a}`]))
  const kindOf = (tile: TileId) => world.board.tiles.get(tile)?.kind

  it('follow its roads, each starting where the last one ended', () => {
    let here = tileId(TOUR_START)
    for (const action of actionsInOrder()) {
      if (action.kind !== 'walk') continue
      const path = action.path.map(tileId)
      expect(path[0]).toBe(here)
      for (let i = 1; i < path.length; i++)
        expect(roads.has(`${path[i - 1]}-${path[i]}`)).toBe(true)
      here = path.at(-1) ?? here
    }
  })

  it('land where his lines say: a plain tile, a red tile for the minigame, then a shop', () => {
    let here = tileId(TOUR_START)
    const seen: Record<string, string | undefined> = {}
    for (const action of actionsInOrder()) {
      if (action.kind === 'walk') here = tileId(action.path.at(-1) ?? here)
      if (action.kind === 'inspect' || action.kind === 'spin' || action.kind === 'shop')
        seen[action.kind] = kindOf(here)
    }
    expect(seen).toEqual({ inspect: 'normal', spin: 'red', shop: 'shop' })
  })
})
