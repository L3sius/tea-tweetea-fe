import { defineStore } from 'pinia'
import { computed, ref, shallowRef, triggerRef } from 'vue'
import { describeProblem, isApiError, type StreamConnection, type StreamMessage } from '@/api'
import type { FeedItem } from '@/domain/activity'
import type { Board } from '@/domain/board'
import type { Challenge } from '@/domain/challenge'
import type { Names } from '@/domain/describe'
import type { GameEvent, JournalEntry } from '@/domain/events'
import type { GameState, Team } from '@/domain/game'
import type { ChallengeId, TeamId } from '@/domain/ids'
import { Choreography } from '@/domain/motion'
import { useApiClient } from './apiClient'

/** Journal entries kept for the game log; also how far back a reload looks for walks to resume. */
const LOG_LENGTH = 120
const FEED_LIMIT = 60
/** Entries arrive in bursts (one per step of a walk), so refetches wait for a quiet moment. */
const REFRESH_DELAY_MS = 300
const ALERT_MS = 9000

/** Most gems first, then most tiles completed, then most gold. */
export const byStanding = (a: Team, b: Team) =>
  b.gems.size - a.gems.size || b.tilesCompleted - a.tilesCompleted || b.gold - a.gold

/** A headline everyone should see, like a minigame opening. */
export type Alert = {
  id: string
  title: string
  text: string
  tone: 'minigame' | 'match' | 'gem' | 'end'
}

/**
 * The public game: board, challenges, the latest state, the activity feed and a game log, kept
 * up to date from the live stream, plus the choreography that animates it.
 */
export const useGameStore = defineStore('game', () => {
  const api = useApiClient()

  const board = shallowRef<Board | null>(null)
  const challenges = shallowRef(new Map<ChallengeId, Challenge>())
  const state = shallowRef<GameState | null>(null)
  const feed = shallowRef<FeedItem[]>([])
  const log = shallowRef<JournalEntry[]>([])
  /** Mutated in place; `triggerRef(choreography)` tells watchers it changed. */
  const choreography = shallowRef(new Choreography())
  const alerts = ref<Alert[]>([])

  const loading = ref(false)
  const error = ref<string | null>(null)
  const connection = ref<StreamConnection | 'connecting'>('connecting')
  /** The server was redeployed since this page loaded. */
  const newBuildAvailable = ref(false)

  /** Server clock minus this browser's clock, so animations line up with journal times. */
  let clockOffset = 0
  const serverNow = () => Date.now() + clockOffset

  const standings = computed(() => [...(state.value?.teams.values() ?? [])].sort(byStanding))

  const names: Names = {
    team: (id) => state.value?.teams.get(id)?.name ?? `Team ${id}`,
    challenge: (id) => challenges.value.get(id)?.name ?? id,
  }

  let closeStream: (() => void) | null = null
  let build: string | null = null

  async function start() {
    if (loading.value || state.value) return
    loading.value = true
    error.value = null
    try {
      const [loadedBoard, loadedChallenges, loadedState, loadedFeed] = await Promise.all([
        api.getBoard(),
        api.getChallenges(),
        api.getState(),
        api.getFeed({ limit: FEED_LIMIT }),
      ])
      board.value = loadedBoard
      challenges.value = loadedChallenges
      feed.value = loadedFeed
      await adopt(loadedState)
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      loading.value = false
    }
  }

  function stop() {
    closeStream?.()
    closeStream = null
    stateRefresh.cancel()
    feedRefresh.cancel()
  }

  /** Takes a fresh snapshot, reloads the log up to it and streams from there. */
  async function adopt(snapshot: GameState) {
    setState(snapshot)
    log.value = await api.getJournal({ after: Math.max(0, snapshot.seq - LOG_LENGTH) })
    const choreo = choreography.value
    for (const entry of log.value) choreo.apply(entry)
    for (const team of snapshot.teams.values()) choreo.know(team.id, team.position)
    triggerRef(choreography)
    closeStream?.()
    closeStream = api.subscribe(snapshot.seq, onMessage)
  }

  function setState(snapshot: GameState) {
    clockOffset = snapshot.serverTime.getTime() - Date.now()
    state.value = snapshot
  }

  function onMessage(message: StreamMessage) {
    switch (message.kind) {
      case 'connection':
        connection.value = message.connection
        return
      case 'hello':
        clockOffset = message.hello.serverTime.getTime() - Date.now()
        build ??= message.hello.build
        if (message.hello.build !== build) newBuildAvailable.value = true
        return
      case 'entry': {
        const last = log.value.at(-1)
        if (last && message.entry.seq <= last.seq) return
        log.value = [...log.value, message.entry].slice(-LOG_LENGTH)
        choreography.value.apply(message.entry)
        triggerRef(choreography)
        raiseAlerts(message.entry.events)
        stateRefresh.schedule()
        return
      }
      case 'feed':
        feedRefresh.schedule()
        return
      case 'resync':
        stop()
        void guard(async () => {
          await adopt(await api.getState())
          feed.value = await api.getFeed({ limit: FEED_LIMIT })
        })
    }
  }

  let alertCount = 0
  /** Headlines wait until the piece that caused them has finished moving, so they never spoil a walk. */
  function raiseAlerts(events: GameEvent[]) {
    for (const event of events) {
      const found = alertFor(event, names)
      if (!found) continue
      const alert = { ...found.alert, id: `alert-${++alertCount}` }
      const wait =
        found.team === null
          ? 0
          : Math.max(0, choreography.value.settlesAt(found.team) - serverNow())
      setTimeout(() => {
        alerts.value = [...alerts.value, alert].slice(-4)
        setTimeout(() => dismiss(alert.id), ALERT_MS)
      }, wait)
    }
  }

  function dismiss(id: string) {
    alerts.value = alerts.value.filter((a) => a.id !== id)
  }

  const stateRefresh = debounced(() =>
    guard(async () => {
      setState(await api.getState())
    }),
  )
  const feedRefresh = debounced(() =>
    guard(async () => {
      feed.value = await api.getFeed({ limit: FEED_LIMIT })
    }),
  )

  /** Fetches the state now, after an action, instead of waiting for the stream. */
  const refreshState = () => guard(async () => setState(await api.getState()))

  /** Background refreshes keep showing the last good data and report what went wrong. */
  async function guard(task: () => Promise<void>) {
    try {
      await task()
      error.value = null
    } catch (e) {
      error.value = messageOf(e)
    }
  }

  return {
    board,
    challenges,
    state,
    feed,
    log,
    choreography,
    alerts,
    loading,
    error,
    connection,
    newBuildAvailable,
    standings,
    names,
    serverNow,
    start,
    stop,
    dismiss,
    refreshState,
  }
})

function alertFor(
  event: GameEvent,
  names: Names,
): { team: TeamId | null; alert: Omit<Alert, 'id'> } | null {
  switch (event.kind) {
    case 'minigame_opened':
      return {
        team: event.initiator,
        alert: {
          title: 'A minigame has opened!',
          text: `${names.team(event.initiator)} landed on a red tile: ${names.challenge(event.challengeId)}. Every team can join in.`,
          tone: 'minigame',
        },
      }
    case 'minigame_closed':
      return {
        team: null,
        alert: {
          title: 'Minigame over',
          text: event.payouts.length
            ? event.payouts.map((p) => `${names.team(p.teamId)} +${p.gold}`).join(' · ')
            : 'Nobody scored.',
          tone: 'minigame',
        },
      }
    case 'match_started':
      return {
        team: event.mover,
        alert: {
          title: `${names.team(event.mover)} vs ${names.team(event.defender)}`,
          text: `A match has started: ${names.challenge(event.challengeId)}.`,
          tone: 'match',
        },
      }
    case 'match_won':
      return {
        team: null,
        alert: {
          title: `${names.team(event.winner)} won the match`,
          text: event.options.length
            ? `${names.team(event.loser)} lost. ${names.team(event.winner)} gets to steal a gem.`
            : `${names.team(event.loser)} had no gem to lose.`,
          tone: 'match',
        },
      }
    case 'gem_stolen':
      return {
        team: null,
        alert: {
          title: 'Gem stolen!',
          text: `${names.team(event.to)} took the ${event.gem} gem from ${names.team(event.from)}.`,
          tone: 'gem',
        },
      }
    case 'gem_collected':
      return {
        team: event.teamId,
        alert: {
          title: `The ${event.gem} gem is taken`,
          text: `${names.team(event.teamId)} picked up the ${event.gem} gem.`,
          tone: 'gem',
        },
      }
    case 'game_ended':
      return {
        team: null,
        alert: {
          title: 'The game is over',
          text: event.winner === null ? 'No winner.' : `${names.team(event.winner)} won!`,
          tone: 'end',
        },
      }
    default:
      return null
  }
}

function messageOf(error: unknown): string {
  if (isApiError(error)) return describeProblem(error.problem)
  return error instanceof Error ? error.message : String(error)
}

function debounced(run: () => unknown) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    schedule() {
      clearTimeout(timer)
      timer = setTimeout(run, REFRESH_DELAY_MS)
    },
    cancel() {
      clearTimeout(timer)
    },
  }
}
