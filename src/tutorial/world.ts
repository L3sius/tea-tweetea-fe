// The tutorial's own world: a frozen copy of the board and of the sample game (its teams dressed as
// characters), so the tour looks the same whatever the live game and map become. Earl Grey's
// routes in script.ts are tiles of this board.
import { endpoints } from '@/api/endpoints'
import type { Board } from '@/domain/board'
import type { Challenge } from '@/domain/challenge'
import type { Names } from '@/domain/describe'
import type { GameState } from '@/domain/game'
import type { ChallengeId } from '@/domain/ids'
import { Choreography } from '@/domain/motion'

export type TutorialWorld = {
  board: Board
  state: GameState
  challenges: ReadonlyMap<ChallengeId, Challenge>
  names: Names
  /** Nothing moves in it but Earl Grey, who has a choreography of his own. */
  choreography: Choreography
}

/** Decodes the frozen copies (wire format, as the server sent them) like any response. */
export function decodeTutorialWorld(json: { board: unknown; state: unknown; challenges: unknown }) {
  const board = endpoints.board.map(endpoints.board.schema.parse(json.board))
  const state = endpoints.state.map(endpoints.state.schema.parse(json.state))
  const challenges = endpoints.challenges.map(endpoints.challenges.schema.parse(json.challenges))
  const names: Names = {
    team: (id) => state.teams.get(id)?.name ?? `Team ${id}`,
    challenge: (id) => challenges.get(id)?.name ?? id,
    seesItems: () => false,
  }
  return { board, state, challenges, names, choreography: new Choreography() }
}

/** Loads the world when a tour starts; it isn't part of the page until then. */
export async function loadTutorialWorld(): Promise<TutorialWorld> {
  const [board, state, challenges] = await Promise.all([
    import('./world/board.json'),
    import('./world/state.json'),
    import('./world/challenges.json'),
  ])
  return decodeTutorialWorld({
    board: board.default,
    state: state.default,
    challenges: challenges.default,
  })
}
