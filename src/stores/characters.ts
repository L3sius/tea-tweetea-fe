import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Appearance } from '@/domain/game'
import type { TeamId } from '@/domain/ids'
import { useGameStore } from './game'
import { useTeamStore } from './team'

/**
 * How each team's piece looks: an OSRS NPC and its idle, walk, run and swim, or null for the
 * default bird. The server keeps it with the team; a team logged in with its code changes its own.
 */
export const useCharacterStore = defineStore('characters', () => {
  const game = useGameStore()
  const my = useTeamStore()

  const saved = ref<string | null>(null)

  function appearanceOf(team: TeamId): Appearance | null {
    return game.state?.teams.get(team)?.appearance ?? null
  }

  /** Whether this browser may change `team`'s look: it is logged in as that team. */
  const canDress = (team: TeamId | null) => team !== null && team === my.teamId

  /** Dresses the logged-in team as `appearance`, or as a bird again with null. */
  async function setAppearance(appearance: Appearance | null): Promise<boolean> {
    saved.value = null
    const seq = await my.act({ kind: 'set_appearance', appearance })
    if (seq === null) return false
    saved.value = appearance ? 'Saved your look.' : 'Back to a bird.'
    return true
  }

  return {
    appearanceOf,
    canDress,
    setAppearance,
    saving: computed(() => my.pending),
    /** What the last save did, or why it failed. */
    message: computed(() =>
      my.error
        ? { text: my.error, tone: 'error' as const }
        : saved.value
          ? { text: saved.value, tone: 'ok' as const }
          : null,
    ),
  }
})
