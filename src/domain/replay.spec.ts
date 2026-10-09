import { describe, expect, it } from 'vitest'
import type { GameEvent, JournalEntry } from './events'
import { instanceId, teamId, tileId } from './ids'
import { STEP_MS } from './motion'
import {
  CATCH_UP_MOVES,
  REPLAY_GAP_MS,
  RETURN_COUNTDOWN_S,
  buildReplay,
  catchUpEntries,
  movesIn,
  tileBefore,
  watchEntries,
} from './replay'

const red = teamId(0)
const blue = teamId(1)
const T0 = Date.parse('2026-10-08T12:00:00Z')

const entry = (seq: number, events: GameEvent[]): JournalEntry => ({
  seq,
  at: new Date(T0 + seq * 60_000),
  events,
})
const card = (seq: number, team = red, steps = 2) =>
  entry(seq, [
    {
      kind: 'card_drawn',
      teamId: team,
      card: { kind: 'suited', rank: steps, suit: 'clubs' },
      steps,
    },
  ])
const walk = (seq: number, path: number[], team = red, land = true) =>
  entry(seq, [
    { kind: 'move_confirmed', teamId: team, path: path.map(tileId) },
    ...path.slice(1).map((t): GameEvent => ({ kind: 'stepped', teamId: team, tileId: tileId(t) })),
    ...(land
      ? [
          {
            kind: 'landed',
            teamId: team,
            tileId: tileId(path.at(-1) ?? 0),
            instanceId: instanceId(1),
          } satisfies GameEvent,
        ]
      : []),
  ])
const start = entry(1, [
  { kind: 'game_started', tileChallenges: [], gemTiles: [], positions: [tileId(5), tileId(6)] },
])

describe('tileBefore', () => {
  it('finds where a team stood before an entry', () => {
    const log = [start, card(2), walk(3, [5, 7, 8])]
    expect(tileBefore(log, 3, red)).toBe(5)
    expect(tileBefore(log, 4, red)).toBe(8)
    expect(tileBefore(log, 4, blue)).toBe(6)
  })

  it('follows teleports', () => {
    const log = [
      start,
      entry(2, [{ kind: 'teleported', teamId: red, from: tileId(5), to: tileId(40) }]),
    ]
    expect(tileBefore(log, 3, red)).toBe(40)
    expect(tileBefore([], 3, red)).toBeNull()
  })
})

describe('watchEntries', () => {
  it('takes the card drawn for the move, and the rest of a paused walk', () => {
    const log = [start, card(2), walk(3, [5, 7, 8], red, false), card(4, blue), walk(5, [8, 9])]
    // Entry 5 carries on red's walk: steps without a new move_confirmed.
    log[4] = entry(5, [
      { kind: 'stepped', teamId: red, tileId: tileId(9) },
      { kind: 'landed', teamId: red, tileId: tileId(9), instanceId: instanceId(1) },
    ])
    expect(watchEntries(log, 3).map((e) => e.seq)).toEqual([2, 3, 5])
  })

  it('is empty for an entry that moves nobody', () => {
    expect(watchEntries([start, card(2)], 2)).toEqual([])
  })
})

describe('catchUpEntries', () => {
  it('plays the moves after the last visit, with their cards, oldest first', () => {
    const log = [start, card(2), walk(3, [5, 7, 8]), card(4, blue), walk(5, [6, 10, 11], blue)]
    expect(catchUpEntries(log, 3).map((e) => e.seq)).toEqual([4, 5])
    expect(catchUpEntries(log, 0).map((e) => e.seq)).toEqual([2, 3, 4, 5])
  })

  it(`keeps only the last ${CATCH_UP_MOVES} moves`, () => {
    const log = [start]
    for (let i = 0; i < 30; i++) log.push(walk(2 + i, [5, 7]))
    expect(catchUpEntries(log, 0).filter((e) => movesIn(e).length)).toHaveLength(CATCH_UP_MOVES)
  })
})

describe('buildReplay', () => {
  it('starts each team where it stood and plays the entries one after another', () => {
    const log = [start, card(2), walk(3, [5, 7, 8]), card(4, blue), walk(5, [6, 10], blue)]
    const now = T0 + 10_000_000
    const replay = buildReplay(log, log.slice(1), now)
    expect([...replay.teams]).toEqual([red, blue])
    // Before its walk, red stands on its old tile, not where it is now.
    expect(replay.choreography.placement(red, now)).toEqual({ kind: 'still', tile: 5 })
    const redWalk = replay.focus[1]?.at ?? 0
    expect(replay.choreography.placement(red, redWalk + STEP_MS / 2)).toMatchObject({
      kind: 'walk',
      from: 5,
      to: 7,
    })
    // Blue's card waits until red's walk has played out, and a gap after it.
    const blueCard = replay.focus[2]?.at ?? 0
    expect(blueCard).toBeGreaterThanOrEqual(redWalk + 2 * STEP_MS + REPLAY_GAP_MS)
    expect(replay.focus.map((f) => f.team)).toEqual([red, red, blue, blue])
    expect(replay.settledAt).toBeGreaterThan(blueCard)
    // A countdown before going back to live, and the pieces stay where the replay left them.
    expect(replay.endsAt - replay.settledAt).toBe(RETURN_COUNTDOWN_S * 1000)
    expect(replay.choreography.finalTile(red)).toBe(8)
    expect(replay.choreography.finalTile(blue)).toBe(10)
  })
})
