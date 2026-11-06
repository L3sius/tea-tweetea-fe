import { describe, expect, it } from 'vitest'
import { isLogged, type GameEvent } from './events'
import { instanceId, teamId, tileId } from './ids'

const progress: GameEvent = {
  kind: 'progress',
  instanceId: instanceId(1),
  teamId: teamId(0),
  key: 'Royal Titans',
  amount: 1,
  progress: { counts: new Map([['Royal Titans', 1]]), done: 1, target: 315, effort: 1 },
}
const at = new Date(0)

describe('isLogged', () => {
  it('leaves out entries of task progress only', () => {
    expect(isLogged({ seq: 1, at, events: [progress] })).toBe(false)
  })

  it('keeps entries with anything else in them', () => {
    const stepped: GameEvent = { kind: 'stepped', teamId: teamId(0), tileId: tileId(3) }
    expect(isLogged({ seq: 2, at, events: [progress, stepped] })).toBe(true)
  })
})
