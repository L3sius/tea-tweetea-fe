/** Game-wide numbers from the server's game config (`GET /rules`); never copied here. */
export type Rules = {
  start: Date
  end: Date
  /** Items a team may hold in total. */
  inventoryLimit: number
  /** Road tiles from the team's tile within which it may place a blocker. */
  blockerRange: number
  blockerLifetimeHours: number
  /** Blockers a team may have on the board at once. */
  blockersPerTeam: number
  /** A team hit by a hostile item cannot be targeted by another for this long. */
  shieldHours: number
  /** Draws a Leprechaun hat or Saturated heart lasts, and gold per rank of a matching card. */
  suitGoldDraws: number
  suitGoldPerRank: number
  /** The gold factor for the team that opened a minigame. */
  initiatorMultiplier: number
  /** Chance of a random event when landing on a normal tile. */
  randomEventChance: number
  /** Minutes a match winner has to pick a gem before one is taken at random. */
  stealMinutes: number
  /** Spawns and random teleports keep at least this many tiles from gems. */
  minGemDistance: number
}
