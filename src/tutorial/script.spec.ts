import { describe, expect, it } from 'vitest'
import { ROSTER } from '@/characters/roster'
import { tileId, type TileId } from '@/domain/ids'
import { GUIDE } from './guide'
import { actionsOf, chapterStart } from './chapters'
import { GESTURE, TOUR_START, TUTORIAL } from './script'
import { decodeTutorialWorld } from './world'
import board from './world/board.json'
import challenges from './world/challenges.json'
import state from './world/state.json'

const world = decodeTutorialWorld({ board, state, challenges })

/** Every action in the order the tour plays it. */
const actionsInOrder = () => TUTORIAL.flatMap(actionsOf)

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

describe('the chapters', () => {
  const index = (id: string) => TUTORIAL.findIndex((beat) => beat.id === id)

  it('each have a title for the contents', () => {
    const titles = TUTORIAL.map((beat) => beat.title)
    expect(titles.every((t) => t.length > 0)).toBe(true)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('start where playing up to them leaves Earl Grey and the page', () => {
    expect(chapterStart(0)).toEqual({ revealed: new Set(), tile: TOUR_START, minigameOpen: false })
    const tile = chapterStart(index('tile'))
    expect(tile.tile).toBe(44)
    expect([...tile.revealed].sort()).toEqual(['gems', 'nodes', 'roads', 'terrain'])
    expect(chapterStart(index('shop'))).toMatchObject({ tile: 308, minigameOpen: true })
  })
})
