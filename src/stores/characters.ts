import { defineStore } from 'pinia'
import { ref } from 'vue'
import { describeProblem, isApiError } from '@/api'
import type { Appearance } from '@/domain/game'
import type { TeamId } from '@/domain/ids'
import { useApiClient } from './apiClient'
import { useDevStore } from './dev'
import { useGameStore } from './game'

/**
 * How each team's piece looks: an OSRS NPC and its idle, walk, run and swim, or null for the
 * default bird. The server keeps it with the team; only admins change it.
 */
export const useCharacterStore = defineStore('characters', () => {
  const api = useApiClient()
  const game = useGameStore()
  // The admin code is the one the dev tools use, kept for the browser session.
  const dev = useDevStore()

  const saving = ref(false)
  const message = ref<{ text: string; tone: 'ok' | 'error' } | null>(null)

  function appearanceOf(team: TeamId): Appearance | null {
    return game.state?.teams.get(team)?.appearance ?? null
  }

  /** Dresses `team` as `appearance`, or as a bird again with null. */
  async function setAppearance(team: TeamId, appearance: Appearance | null): Promise<boolean> {
    if (saving.value) return false
    saving.value = true
    message.value = null
    try {
      await api.sendAdminCommand({
        adminCode: dev.adminCode,
        command: { kind: 'set_appearance', teamId: team, appearance },
      })
      await game.refreshState()
      message.value = { text: `Saved ${game.names.team(team)}’s look.`, tone: 'ok' }
      return true
    } catch (e) {
      message.value = {
        text: isApiError(e) ? describeProblem(e.problem) : String(e),
        tone: 'error',
      }
      return false
    } finally {
      saving.value = false
    }
  }

  return { saving, message, appearanceOf, setAppearance }
})
