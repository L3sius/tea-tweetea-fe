import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { describeProblem, isApiError } from '@/api'
import type { AdminCommand, AdminReply } from '@/domain/commands'
import type { TeamId } from '@/domain/ids'
import {
  NO_THROTTLE,
  afterFailure,
  lockLeft,
  parseThrottle,
  type LoginThrottle,
} from '@/domain/loginThrottle'
import type { Overview } from '@/domain/server'
import { useApiClient } from './apiClient'
import { useGameStore } from './game'

/** Shared with the dev tools, so logging in on one logs in on the other. */
const CODE_KEY = 'tweetea.adminCode'
const THROTTLE_KEY = 'tweetea.adminThrottle'

/** A team's new code, shown once: the server keeps only its hash. */
export type IssuedCode = { teamId: TeamId; name: string; code: string }

/**
 * The admin page: its login, the admin-only overview and every admin command. The server checks
 * the admin code on each request; this store only keeps it for the tab, like the dev tools do.
 */
export const useAdminStore = defineStore('admin', () => {
  const api = useApiClient()
  const game = useGameStore()

  const code = ref('')
  const loggedIn = ref(false)
  const overview = shallowRef<Overview | null>(null)
  const pending = ref(false)
  const message = ref<{ text: string; tone: 'ok' | 'error' } | null>(null)
  const issued = shallowRef<IssuedCode | null>(null)
  const throttle = shallowRef<LoginThrottle>(readThrottle())
  const lockedUntil = computed(() => throttle.value.lockedUntil)

  async function login(entered: string) {
    const trimmed = entered.trim()
    if (!trimmed || pending.value || lockLeft(throttle.value, Date.now()) > 0) return
    const result = await check(trimmed)
    if (result === 'accepted') setThrottle(NO_THROTTLE)
    else if (result === 'unknown_code') setThrottle(afterFailure(throttle.value, Date.now()))
  }

  /** Logs back in with the code this tab used before; it worked then, so it skips the throttle. */
  async function restore() {
    if (loggedIn.value) return
    const saved = readSession()
    if (saved) await check(saved)
  }

  async function check(candidate: string): Promise<'accepted' | 'unknown_code' | 'failed'> {
    pending.value = true
    message.value = null
    try {
      overview.value = await api.getOverview(candidate)
      code.value = candidate
      loggedIn.value = true
      writeSession(candidate)
      return 'accepted'
    } catch (e) {
      const unknown = isApiError(e) && e.problem.kind === 'unauthorized'
      message.value = {
        text: unknown ? 'That admin code was not recognised.' : textOf(e),
        tone: 'error',
      }
      return unknown ? 'unknown_code' : 'failed'
    } finally {
      pending.value = false
    }
  }

  function logout() {
    code.value = ''
    loggedIn.value = false
    overview.value = null
    issued.value = null
    message.value = null
    writeSession(null)
  }

  async function refresh() {
    if (!loggedIn.value) return
    try {
      overview.value = await api.getOverview(code.value)
    } catch (e) {
      if (isApiError(e) && e.problem.kind === 'unauthorized') logout()
    }
  }

  /** Sends a command; resolves to the server's reply, or null if it was refused. */
  async function run(command: AdminCommand, done: string): Promise<AdminReply | null> {
    if (pending.value || !loggedIn.value) return null
    pending.value = true
    message.value = null
    try {
      const reply = await api.sendAdminCommand({ adminCode: code.value, command })
      await Promise.all([game.refreshState(), refresh()])
      if (reply.kind === 'issued')
        issued.value = {
          teamId: reply.teamId,
          name: game.names.team(reply.teamId),
          code: reply.code,
        }
      message.value = { text: done, tone: 'ok' }
      return reply
    } catch (e) {
      message.value = { text: textOf(e), tone: 'error' }
      return null
    } finally {
      pending.value = false
    }
  }

  // Inventories change with the game; refetch them once a burst of new entries has passed.
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  watch(
    () => game.log.at(-1)?.seq,
    () => {
      if (!loggedIn.value) return
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => void refresh(), 1000)
    },
  )

  function setThrottle(next: LoginThrottle) {
    throttle.value = next
    try {
      if (next.failures === 0) localStorage.removeItem(THROTTLE_KEY)
      else localStorage.setItem(THROTTLE_KEY, JSON.stringify(next))
    } catch {
      // Storage blocked: the lock lasts for this visit only.
    }
  }

  return {
    code,
    loggedIn,
    overview,
    pending,
    message,
    issued,
    lockedUntil,
    login,
    restore,
    logout,
    refresh,
    run,
  }
})

function readThrottle(): LoginThrottle {
  try {
    return parseThrottle(localStorage.getItem(THROTTLE_KEY))
  } catch {
    return NO_THROTTLE
  }
}

function readSession(): string | null {
  try {
    return sessionStorage.getItem(CODE_KEY)
  } catch {
    return null
  }
}

function writeSession(value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(CODE_KEY)
    else sessionStorage.setItem(CODE_KEY, value)
  } catch {
    // Kept in memory only.
  }
}

function textOf(error: unknown): string {
  if (isApiError(error)) return describeProblem(error.problem)
  return error instanceof Error ? error.message : String(error)
}
