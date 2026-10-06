import { defineStore } from 'pinia'
import { ref, shallowRef, watch } from 'vue'
import { describeProblem, isApiError } from '@/api'
import type { ObservationKind, StatRow, StatsGroup } from '@/domain/activity'
import type { TeamId } from '@/domain/ids'
import { useApiClient } from './apiClient'
import { useGameStore } from './game'

export type StatsFilter = { kind: ObservationKind | null; teamId: TeamId | null }

/** Every grouping the stats page shows, for one filter. */
export type StatsTables = Record<StatsGroup, StatRow[]> & {
  /** Totals per kind of activity, for the headline tiles. */
  kinds: Partial<Record<ObservationKind, StatRow>>
}

const KINDS: ObservationKind[] = [
  'loot',
  'kill_count',
  'clue',
  'pet',
  'slayer',
  'combat_achievement',
]

/** Live stats: refetched whenever new Dink activity arrives. */
export const useStatsStore = defineStore('stats', () => {
  const api = useApiClient()
  const game = useGameStore()

  const filter = ref<StatsFilter>({ kind: null, teamId: null })
  const tables = shallowRef<StatsTables | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let active = false

  async function load() {
    loading.value = true
    try {
      const { kind, teamId } = filter.value
      const query = { kind: kind ?? undefined, teamId: teamId ?? undefined }
      const [account, team, subject, hour, ...perKind] = await Promise.all([
        api.getStats({ by: 'account', ...query, limit: 50 }),
        api.getStats({ by: 'team', ...query }),
        api.getStats({ by: 'subject', ...query, limit: 50 }),
        api.getStats({ by: 'hour', ...query, limit: 24 * 30 }),
        ...KINDS.map((k) => api.getStats({ by: 'team', kind: k, teamId: query.teamId })),
      ])
      const kinds: StatsTables['kinds'] = {}
      KINDS.forEach((k, i) => {
        const rows = perKind[i] ?? []
        kinds[k] = {
          key: k,
          count: rows.reduce((a, r) => a + r.count, 0),
          value: rows.reduce((a, r) => a + r.value, 0),
        }
      })
      tables.value = { account, team, subject, hour, kinds }
      error.value = null
    } catch (e) {
      error.value = isApiError(e) ? describeProblem(e.problem) : String(e)
    } finally {
      loading.value = false
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  watch(
    () => game.feed,
    () => {
      if (!active) return
      clearTimeout(timer)
      timer = setTimeout(load, 1_000)
    },
  )
  watch(filter, () => void load(), { deep: true })

  /** Starts loading and keeping the stats live while the page shows them. */
  function open() {
    active = true
    void load()
  }
  function close() {
    active = false
    clearTimeout(timer)
  }

  return { filter, tables, loading, error, open, close }
})
