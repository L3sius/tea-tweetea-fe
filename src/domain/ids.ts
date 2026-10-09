// Every id on the wire is a plain number, so brands stop a team id from being passed where a
// tile id is expected. Brands exist only at compile time.
declare const brand: unique symbol
type Brand<T, B extends string> = T & { readonly [brand]: B }

export type TeamId = Brand<number, 'TeamId'>
export type TileId = Brand<number, 'TileId'>
export type InstanceId = Brand<number, 'InstanceId'>
export type MinigameId = Brand<number, 'MinigameId'>
export type ChallengeId = Brand<string, 'ChallengeId'>

export const teamId = (id: number) => id as TeamId
export const tileId = (id: number) => id as TileId
export const instanceId = (id: number) => id as InstanceId
export const minigameId = (id: number) => id as MinigameId
export const challengeId = (id: string) => id as ChallengeId
