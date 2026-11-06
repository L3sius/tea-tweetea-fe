import { describe, expect, it } from 'vitest'
import { teamId, tileId, type TileId } from '@/domain/ids'
import { STEP_MS, type Placement, type Reaction } from '@/domain/motion'
import { chance, perform, pick, type Situation } from './acting'
import {
  RANDOM,
  RANDOM_STYLES,
  ROSTER,
  RUN_FROM_STEPS,
  defaultAppearance,
  optionIds,
  type Style,
} from './roster'

const red = teamId(0)
const T0 = Date.parse('2026-10-08T12:00:00Z')
const look = { ...defaultAppearance(), walk: 1306, run: 2251, swim: 3415 }
const walkOf = (steps: number, seq = 1, progress = 0.5): Placement => ({
  kind: 'walk',
  from: tileId(1),
  to: tileId(2),
  progress,
  steps,
  seq,
})

function situation(over: Partial<Situation> = {}): Situation {
  return {
    team: red,
    time: T0,
    placement: { kind: 'still', tile: tileId(1) },
    appearance: look,
    stuck: null,
    reactions: [],
    isSea: () => false,
    isOccupied: () => false,
    lengthOf: () => 1_000,
    ...over,
  }
}

/** A walk whose seq doesn't roll the easter-egg gait, so the team's own style shows. */
const plainSeq =
  Array.from({ length: 100 }, (_, i) => i).find(
    (seq) => chance(red, seq, 'gait') >= ROSTER.easterEggs.gaitChancePerWalk,
  ) ?? 0

describe('perform', () => {
  it("walks short walks and runs long ones in the team's style", () => {
    expect(perform(situation({ placement: walkOf(RUN_FROM_STEPS - 1, plainSeq) })).anim).toBe(1306)
    expect(perform(situation({ placement: walkOf(RUN_FROM_STEPS, plainSeq) })).anim).toBe(2251)
  })

  it('swims at sea', () => {
    const sea = (tile: TileId) => tile === tileId(2)
    expect(perform(situation({ placement: walkOf(3), isSea: sea })).anim).toBe(3415)
  })

  it('picks a new gait from the pool on each move when the style is random', () => {
    const random = { ...look, walk: RANDOM, run: RANDOM, swim: RANDOM }
    const gaits = (style: Style) =>
      Array.from({ length: 200 }, (_, seq) => {
        const steps = style === 'run' ? RUN_FROM_STEPS : 3
        const isSea = () => style === 'swim'
        return perform(situation({ appearance: random, placement: walkOf(steps, seq), isSea })).anim
      })
    for (const style of RANDOM_STYLES) {
      const picked = new Set(gaits(style))
      expect([...picked].every((anim) => optionIds(style).includes(anim))).toBe(true)
      expect(picked.size).toBeGreaterThan(optionIds(style).length / 2)
    }
  })

  it('keeps one random gait for the whole move, the same for everyone watching', () => {
    const random = { ...look, walk: RANDOM }
    const at = (progress: number) =>
      perform(situation({ appearance: random, placement: walkOf(3, 7, progress) })).anim
    expect(at(0.1)).toBe(at(0.9))
  })

  it('now and then walks in another style, the same for everyone watching', () => {
    const walks = Array.from({ length: 400 }, (_, seq) =>
      perform(situation({ placement: walkOf(3, seq) })),
    )
    const odd = walks.filter((p) => p.anim !== 1306)
    expect(odd.length).toBeGreaterThan(5)
    expect(odd.length).toBeLessThan(60)
    expect(perform(situation({ placement: walkOf(3, 7) }))).toEqual(
      perform(situation({ placement: walkOf(3, 7) })),
    )
  })

  it('climbs past a team over two steps', () => {
    const occupied = (tile: TileId) => tile === tileId(2)
    const onto = perform(situation({ placement: walkOf(3), isOccupied: occupied }))
    expect(onto.anim).toBe(ROSTER.reactions.pass[0])
    expect(onto.since).toBe(T0 - 0.5 * STEP_MS)
    expect(onto.rate).toBeCloseTo(1_000 / (2 * STEP_MS))
  })

  it('reacts until the reaction has played, then idles', () => {
    const cheer: Reaction = { id: '5.0', teamId: red, kind: 'celebrate', at: T0 }
    const during = perform(situation({ time: T0 + 500, reactions: [cheer] }))
    expect(ROSTER.reactions.celebrate).toContain(during.anim)
    expect(during.since).toBe(T0)
    const after = perform(situation({ time: T0 + 1_000, reactions: [cheer] }))
    expect(after.anim).not.toBe(during.anim)
  })

  it('holds one pose for the whole freeze, from what caused it', () => {
    const stuck = { until: T0 + 3_600_000, cause: 'banana' as const }
    const poses = [0, 60_000, 600_000].map(
      (later) => perform(situation({ time: T0 + later, stuck })).anim,
    )
    expect(new Set(poses).size).toBe(1)
    expect(ROSTER.stuck.banana.hold).toContain(poses[0])
    const iced = perform(situation({ stuck: { ...stuck, cause: 'ice_barrage' } })).anim
    expect(ROSTER.stuck.ice_barrage.hold).toContain(iced)
  })

  it('plays the hit of what struck the team, then holds its pose', () => {
    const hit: Reaction = { id: '9.1', teamId: red, kind: 'struck', cause: 'snake_charmer', at: T0 }
    const stuck = { until: T0 + 3_600_000, cause: 'snake_charmer' as const }
    const during = perform(situation({ time: T0 + 100, reactions: [hit], stuck }))
    expect(ROSTER.stuck.snake_charmer.hit).toContain(during.anim)
    const after = perform(situation({ time: T0 + 9_000, reactions: [hit], stuck }))
    expect(ROSTER.stuck.snake_charmer.hold).toContain(after.anim)
  })

  it('gets back up as a banana lets go', () => {
    const up: Reaction = { id: '9.2', teamId: red, kind: 'freed', cause: 'banana', at: T0 }
    const during = perform(situation({ time: T0 + 100, reactions: [up] }))
    expect(ROSTER.stuck.banana.free).toContain(during.anim)
    expect(during.sideways).toBe(true)
  })

  it('stays sitting partway through the slip, where the fall leaves it', () => {
    const { hit, holdAt } = ROSTER.stuck.banana
    const stuck = { until: T0 + 3_600_000, cause: 'banana' as const }
    const slip: Reaction = { id: '9.1', teamId: red, kind: 'struck', cause: 'banana', at: T0 }
    const falling = perform(situation({ time: T0 + 100, reactions: [slip], stuck }))
    expect(falling).toMatchObject({ anim: hit[0], since: T0, stopAt: holdAt })
    const floored = perform(situation({ time: T0 + 60_000, reactions: [slip], stuck }))
    expect(floored).toMatchObject({ anim: hit[0], stopAt: holdAt })
  })

  it('turns into an omelette from the Handegg hit until it is free', () => {
    const { hit, hold, becomes } = ROSTER.stuck.handegg
    const stuck = { until: T0 + 3_600_000, cause: 'handegg' as const }
    const splat: Reaction = { id: '9.1', teamId: red, kind: 'struck', cause: 'handegg', at: T0 }
    const splatting = perform(situation({ time: T0 + 100, reactions: [splat], stuck }))
    expect(splatting).toMatchObject({ anim: hit[0], disguise: becomes })
    const lying = perform(situation({ time: T0 + 60_000, reactions: [splat], stuck }))
    expect(lying).toMatchObject({ anim: hold[0], disguise: becomes })
    const up: Reaction = {
      id: '9.2',
      teamId: red,
      kind: 'freed',
      cause: 'handegg',
      at: T0 + 60_000,
    }
    const free = perform(situation({ time: T0 + 60_100, reactions: [up, splat] }))
    expect(free.disguise).toBeUndefined()
    expect(perform(situation({ stuck: { ...stuck, cause: 'entangle' } })).disguise).toBeUndefined()
  })

  it('lies across the screen while floored, and only then', () => {
    const until = T0 + 3_600_000
    expect(perform(situation({ stuck: { until, cause: 'banana' } })).sideways).toBe(true)
    expect(perform(situation({ stuck: { until, cause: 'ice_barrage' } })).sideways).toBeUndefined()
    expect(perform(situation({})).sideways).toBeUndefined()
  })

  it('every cause has a pose to hold, and only an itemless freeze goes without a hit', () => {
    const counts = Object.entries(ROSTER.stuck).map(([cause, { hit, hold }]) => ({
      cause,
      hits: hit.length > 0,
      holds: hold.length > 0,
    }))
    for (const c of counts)
      expect(c).toEqual({ cause: c.cause, hits: c.cause !== 'other', holds: true })
  })

  it('stands idle, with an occasional emote', () => {
    const minutes = Array.from({ length: 200 }, (_, m) =>
      Array.from({ length: 60 }, (_, s) =>
        perform(situation({ time: T0 + m * 60_000 + s * 1_000 })),
      ),
    )
    const withEgg = minutes.filter((m) => m.some((p) => p.anim !== look.idle))
    expect(withEgg.length).toBeGreaterThan(5)
    expect(withEgg.length).toBeLessThan(60)
  })
})

describe('pick', () => {
  it('chooses the same way for the same seed', () => {
    expect(pick([1, 2, 3, 4], 'a', 1)).toBe(pick([1, 2, 3, 4], 'a', 1))
    expect(pick([], 'a')).toBeNull()
  })
})
