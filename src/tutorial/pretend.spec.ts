import { describe, expect, it } from 'vitest'
import { tileId } from '@/domain/ids'
import { GUIDE, GUIDE_TEAM } from './guide'
import { PretendGame } from './pretend'
import { decodeTutorialWorld } from './world'
import board from './world/board.json'
import challenges from './world/challenges.json'
import state from './world/state.json'

const world = decodeTutorialWorld({ board, state, challenges })
const NOW = new Date('2026-10-10T12:00:00Z')
/** A plain tile, a red tile and a shop of the tutorial's board (Earl Grey's route). */
const [PLAIN, RED, SHOP] = [tileId(44), tileId(308), tileId(307)]

describe('the pretend game', () => {
  it('has Earl Grey take on the task of the tile he lands on, as the side panel shows', () => {
    const game = new PretendGame(world, PLAIN)
    game.landOn(PLAIN, NOW)
    const status = game.team.status
    expect(status.kind).toBe('working')
    const task = status.kind === 'working' ? game.state().instances.get(status.instanceId) : null
    expect(task?.challengeId).toBe(world.state.tileChallenges.get(PLAIN))
    expect(task?.scope).toEqual({ kind: 'tile', teamId: GUIDE_TEAM, tileId: PLAIN })
  })

  it('keeps his task on a shop, which has none of its own', () => {
    const game = new PretendGame(world, RED)
    game.landOn(RED, NOW)
    game.landOn(SHOP, NOW)
    expect(game.team.position).toBe(SHOP)
    expect(game.team.status.kind).toBe('working')
  })

  it('opens his minigame for every team, under the name the slot machine shows', () => {
    const game = new PretendGame(world, RED)
    game.openMinigame(NOW)
    const opened = [...game.state().minigames.values()].find((m) => m.initiator === GUIDE_TEAM)
    const task = opened && game.state().instances.get(opened.instanceId)
    expect(task && game.names().challenge(task.challengeId)).toBe(game.minigameName())
    expect(task?.progress.size).toBe(world.state.teams.size + 1)
    expect(opened && opened.deadline > NOW).toBe(true)
  })

  it('names him, and leaves the world untouched', () => {
    const game = new PretendGame(world, PLAIN)
    game.openMinigame(NOW)
    expect(game.names().team(GUIDE_TEAM)).toBe(GUIDE.name)
    expect([...world.state.minigames.values()].some((m) => m.initiator === GUIDE_TEAM)).toBe(false)
  })
})
