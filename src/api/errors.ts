/** Everything that can go wrong talking to the game API. */
export type ApiProblem =
  /** The request never got a response: offline, DNS, CORS. */
  | { kind: 'network'; message: string }
  /** Wrong team or admin code. */
  | { kind: 'unauthorized' }
  /** Someone else acted for the team first; refetch the state and try again. */
  | { kind: 'stale_version' }
  /** The game rules forbid the action right now. */
  | { kind: 'rule_violation'; message: string }
  | { kind: 'server'; status: number; message: string }
  /** The response did not match the contract: the API changed or is broken. */
  | { kind: 'invalid_response'; endpoint: string; details: string }

export class ApiError extends Error {
  constructor(readonly problem: ApiProblem) {
    super(describeProblem(problem))
    this.name = 'ApiError'
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError

export function describeProblem(problem: ApiProblem): string {
  switch (problem.kind) {
    case 'network':
      return `Could not reach the game server: ${problem.message}`
    case 'unauthorized':
      return 'That code was not recognised.'
    case 'stale_version':
      return 'Your team changed since this page last updated. Refresh and try again.'
    case 'rule_violation':
      return problem.message
    case 'server':
      return `The game server failed (${problem.status}): ${problem.message}`
    case 'invalid_response':
      return `Unexpected response from ${problem.endpoint}:\n${problem.details}`
  }
}

/** Maps a non-2xx status and the server's `{ error }` message to a problem. */
export function problemFromStatus(status: number, message: string): ApiProblem {
  switch (status) {
    case 401:
      return { kind: 'unauthorized' }
    case 409:
      return { kind: 'stale_version' }
    case 422:
      return { kind: 'rule_violation', message }
    default:
      return { kind: 'server', status, message }
  }
}
