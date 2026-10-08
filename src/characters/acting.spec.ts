import { describe, expect, it } from 'vitest'
import { teamId, tileId, type TileId } from '@/domain/ids'
import { STEP_MS, type Placement, type Reaction } from '@/domain/motion'
import { chance, perform, pick, type Situation } from './acting'
import { ROSTER, RUN_FROM_STEPS, defaultAppearance } from './roster'

const red = teamId(0)
const T0 = Date.parse('2026-10-08T12:00:00Z')
const look = { ...defaultAppearance(), walk: 1306, run: 2251, swim: 3415 }
const walkOf = (steps: number, seq = 1): Placement => ({
  kind: 'walk',
  from: tileId(1),
  to: tileId(2),
  progress: 0.5,
  steps,
  seq,
})

function situation(over: Partial<Situation> = {}): Situation {
  return {
    team: red,
    time: T0,
    placement: { kind: 'still', tile: tileId(1) },
    appearance: look,
    frozenUntil: null,
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

  it('holds one frozen pose for the whole freeze', () => {
    const frozenUntil = T0 + 3_600_000
    const poses = [0, 60_000, 600_000].map(
      (later) => perform(situation({ time: T0 + later, frozenUntil })).anim,
    )
    expect(new Set(poses).size).toBe(1)
    expect(ROSTER.reactions.frozen).toContain(poses[0])
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
