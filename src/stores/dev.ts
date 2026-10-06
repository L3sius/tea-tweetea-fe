import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { describeProblem, isApiError } from '@/api'
import type { AdminCommand } from '@/domain/commands'
import { describeEvent } from '@/domain/describe'
import type { Card } from '@/domain/game'
import type { TeamId, TileId } from '@/domain/ids'
import type { Item } from '@/domain/vocabulary'
import { useApiClient } from './apiClient'
import { useGameStore } from './game'

const CODE_KEY = 'tweetea.adminCode'

/**
 * Play-testing tools: admin shortcuts that put a team in any state worth testing. Shown in
 * development builds, or with `?dev` in the URL. The server's own dev actions (items, cards,
 * teleports, freezing) only work when it runs with DEV_TOOLS=1.
 */
export const useDevStore = defineStore('dev', () => {
  const api = useApiClient()
  const game = useGameStore()

  const enabled = import.meta.env.DEV || new URLSearchParams(window.location.search).has('dev')

  const adminCode = ref(readCode() ?? (import.meta.env.DEV ? 'admin' : ''))
  /** The team the tools act on. */
  const teamId = ref<TeamId | null>(null)
  const pending = ref(false)
  const message = ref<{ text: string; tone: 'ok' | 'error' } | null>(null)
  /** Waiting for a map click to teleport the team there. */
  const pickingTile = ref(false)
  /**
   * The next card the managed team draws through the normal card pick. The pick then sends the
   * dev draw instead of a real one, so the reveal can be tested with any card.
   */
  const riggedCard = shallowRef<Card | null>(null)

  function readCode(): string | null {
    try {
      return sessionStorage.getItem(CODE_KEY)
    } catch {
      return null
    }
  }

  function saveCode() {
    try {
      sessionStorage.setItem(CODE_KEY, adminCode.value)
    } catch {
      // Kept in memory only.
    }
  }

  /** Sends an admin command; resolves to the seq it produced, or null if refused. */
  async function run(command: AdminCommand, done: string): Promise<number | null> {
    if (pending.value) return null
    pending.value = true
    message.value = null
    saveCode()
    try {
      const reply = await api.sendAdminCommand({ adminCode: adminCode.value, command })
      await game.refreshState()
      message.value = { text: done, tone: 'ok' }
      return reply.kind === 'accepted' ? reply.seq : 0
    } catch (e) {
      message.value = {
        text: isApiError(e) ? describeProblem(e.problem) : String(e),
        tone: 'error',
      }
      return null
    } finally {
      pending.value = false
    }
  }

  const team = () => teamId.value
  const name = () => (teamId.value === null ? '' : game.names.team(teamId.value))

  function withTeam(make: (team: TeamId) => AdminCommand, done: () => string) {
    const t = team()
    if (t === null) {
      message.value = { text: 'Pick a team first.', tone: 'error' }
      return Promise.resolve(null)
    }
    return run(make(t), done())
  }

  const completeTile = () =>
    withTeam(
      (t) => ({ kind: 'complete_tile', teamId: t }),
      () => `${name()}’s tile is complete.`,
    )
  const adjustGold = (delta: number) =>
    withTeam(
      (t) => ({ kind: 'adjust_gold', teamId: t, delta }),
      () => `${delta > 0 ? '+' : ''}${delta} gold for ${name()}.`,
    )
  const giveItem = (item: Item) =>
    withTeam(
      (t) => ({ kind: 'dev_give_item', teamId: t, item }),
      () => `Gave ${name()} an item.`,
    )
  const drawCard = (card: Card) =>
    withTeam(
      (t) => ({ kind: 'dev_draw_card', teamId: t, card }),
      () => `${name()} drew the chosen card.`,
    )
  /** A held Monk's Pendant blocks the freeze and is used up, as with any other freeze. */
  const freeze = (hours: number) => {
    const t = teamId.value === null ? null : game.state?.teams.get(teamId.value)
    const pendant = (t?.items.get('monks_pendant') ?? 0) > 0
    return withTeam(
      (id) => ({ kind: 'dev_freeze', teamId: id, hours }),
      () =>
        pendant
          ? `${name()}’s Monk’s Pendant blocked the freeze.`
          : `${name()} is frozen for ${hours}h.`,
    )
  }
  const thaw = () =>
    withTeam(
      (t) => ({ kind: 'dev_thaw', teamId: t }),
      () => `${name()} thawed out.`,
    )

  async function teleport(tile: TileId) {
    pickingTile.value = false
    await withTeam(
      (t) => ({ kind: 'dev_teleport', teamId: t, tileId: tile }),
      () => `${name()} moved to tile #${tile}.`,
    )
  }

  /**
   * Puts the team at the start of its turn, ready for the power-up step: thaws it, moves it off a
   * drawn card or a walk (to a neighbouring tile), then completes the tile.
   */
  async function makeReady() {
    const id = teamId.value
    const t = id === null ? null : game.state?.teams.get(id)
    if (id === null || !t)
      return void (message.value = { text: 'Pick a team first.', tone: 'error' })
    if (t.frozenUntil && t.frozenUntil.getTime() > game.serverNow()) {
      if ((await thaw()) === null) return
    }
    if (t.status.kind === 'drawn' || t.status.kind === 'moving') {
      const next = game.board?.roads.find(([a, b]) => a === t.position || b === t.position)
      const tile = next ? (next[0] === t.position ? next[1] : next[0]) : null
      if (tile === null) return void (message.value = { text: 'No tile next door.', tone: 'error' })
      if ((await run({ kind: 'dev_teleport', teamId: id, tileId: tile }, 'Moved.')) === null) return
    }
    const current = game.state?.teams.get(id)
    if (current?.status.kind === 'ready')
      return void (message.value = { text: `${name()} is ready to draw.`, tone: 'ok' })
    await run({ kind: 'complete_tile', teamId: id }, `${name()} is ready to draw.`)
  }

  /** What undo would take back: the newest journal entry, described. */
  function lastEntry() {
    const entry = game.log.at(-1)
    if (!entry) return null
    const text =
      entry.events.map((e) => describeEvent(e, game.names)).find((t) => t !== null) ??
      `${entry.events.length} bookkeeping events`
    return { seq: entry.seq, text }
  }

  /** Reverts the newest journal entry; the server replays the rest and tells every page to resync. */
  async function undo() {
    const last = lastEntry()
    if (!last) return
    await run({ kind: 'revert', seq: last.seq }, `Undid #${last.seq}: ${last.text}`)
  }

  return {
    enabled,
    adminCode,
    teamId,
    pending,
    message,
    pickingTile,
    riggedCard,
    run,
    completeTile,
    adjustGold,
    giveItem,
    drawCard,
    freeze,
    thaw,
    teleport,
    makeReady,
    lastEntry,
    undo,
  }
})
