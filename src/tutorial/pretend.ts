// The tour's pretend game: the frozen world (tutorial/world) with Earl Grey playing in it as a team
// of his own, so the side panel shows the tile he stands on and the minigame he opens, just as it
// would for a real team. He isn't one of the world's teams, so the map draws him only as the guide.
import type { Names } from '@/domain/describe'
import type { GameState, Instance, Minigame, Team, TeamProgress } from '@/domain/game'
import { instanceId, minigameId, type TeamId, type TileId } from '@/domain/ids'
import { GUIDE, GUIDE_TEAM } from './guide'
import type { TutorialWorld } from './world'

/** Ids no frozen instance or minigame uses. */
const TILE_TASK = instanceId(900_000)
const MINIGAME = minigameId(900_000)
const MINIGAME_TASK = instanceId(900_001)
/** How long his minigame runs, as far as the panel's countdown is concerned. */
const MINIGAME_MS = 2 * 60 * 60 * 1000

const fresh = (target: number): TeamProgress => ({
  counts: new Map(),
  done: 0,
  target,
  effort: null,
})

export class PretendGame {
  readonly team: Team
  private tileTask: Instance | null = null
  private minigame: { minigame: Minigame; task: Instance } | null = null

  constructor(
    private readonly world: TutorialWorld,
    start: TileId,
  ) {
    this.team = {
      id: GUIDE_TEAM,
      name: GUIDE.name,
      members: [{ name: GUIDE.name, accounts: [] }],
      position: start,
      status: { kind: 'idle' },
      frozenUntil: null,
      shieldUntil: null,
      matchId: null,
      gems: new Set(),
      gold: 0,
      effects: { moveMultiplier: 1, nextMoveHalved: false, suitGold: null, itemUsedHere: false },
      tilesCompleted: 0,
      version: 0,
      appearance: {
        npc: GUIDE.npc,
        idle: GUIDE.idle,
        walk: GUIDE.walk,
        run: GUIDE.run,
        swim: GUIDE.idle,
      },
    }
  }

  /** He stands on `tile`, and takes on its task if it has one (a shop has none). */
  landOn(tile: TileId, now: Date) {
    this.team.position = tile
    const challengeId = this.world.state.tileChallenges.get(tile)
    if (!challengeId) return
    this.tileTask = {
      id: TILE_TASK,
      challengeId,
      startedAt: now,
      scope: { kind: 'tile', teamId: GUIDE_TEAM, tileId: tile },
      progress: new Map([[GUIDE_TEAM, fresh(this.targetOf(challengeId))]]),
      done: new Set(),
    }
    this.team.status = { kind: 'working', instanceId: TILE_TASK }
  }

  /** The minigame he opens on a red tile: one the sample game played, so its scoring is real. */
  private template(): { minigame: Minigame; task: Instance } | null {
    for (const minigame of this.world.state.minigames.values()) {
      const task = this.world.state.instances.get(minigame.instanceId)
      if (task) return { minigame, task }
    }
    return null
  }

  /** The name his minigame shows, for the slot machine to land on. */
  minigameName(): string {
    const template = this.template()
    return template ? this.world.names.challenge(template.task.challengeId) : 'A minigame'
  }

  /** Opens his minigame, which every team can join. */
  openMinigame(now: Date) {
    const template = this.template()
    if (!template || this.minigame) return
    const teams: TeamId[] = [GUIDE_TEAM, ...this.world.state.teams.keys()]
    const target = this.targetOf(template.task.challengeId)
    this.minigame = {
      minigame: {
        ...template.minigame,
        id: MINIGAME,
        instanceId: MINIGAME_TASK,
        initiator: GUIDE_TEAM,
        // Hours away by the server's clock and this browser's, which the panel counts down by.
        deadline: new Date(Math.max(now.getTime(), Date.now()) + MINIGAME_MS),
        finished: [],
        payouts: null,
      },
      task: {
        id: MINIGAME_TASK,
        challengeId: template.task.challengeId,
        startedAt: now,
        scope: { kind: 'minigame', minigameId: MINIGAME },
        progress: new Map(teams.map((team) => [team, fresh(target)])),
        done: new Set(),
      },
    }
  }

  /**
   * The world's game with his task and minigame in it. The sample game's own minigames and matches
   * are long over, so his minigame is the only one.
   */
  state(): GameState {
    const base = this.world.state
    const instances = new Map(base.instances)
    const minigames = new Map<Minigame['id'], Minigame>()
    if (this.tileTask) instances.set(this.tileTask.id, this.tileTask)
    if (this.minigame) {
      instances.set(this.minigame.task.id, this.minigame.task)
      minigames.set(this.minigame.minigame.id, this.minigame.minigame)
    }
    return { ...base, instances, minigames, matches: new Map() }
  }

  names(): Names {
    const names = this.world.names
    return { ...names, team: (id) => (id === GUIDE_TEAM ? GUIDE.name : names.team(id)) }
  }

  /** A task's goal, as the sample game set it for another team, or 1. */
  private targetOf(challengeId: string): number {
    for (const instance of this.world.state.instances.values()) {
      if (instance.challengeId !== challengeId) continue
      const progress = instance.progress.values().next().value
      if (progress) return progress.target
    }
    return 1
  }
}
