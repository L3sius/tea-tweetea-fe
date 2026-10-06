import { useIntervalFn, useNow } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { describeProblem, isApiError } from '@/api'
import type { ItemTarget, TeamCommand } from '@/domain/commands'
import { drawOutcome, type DrawOutcome } from '@/domain/draw'
import type { JournalEntry } from '@/domain/events'
import type { Team } from '@/domain/game'
import { tileId, type TeamId, type TileId } from '@/domain/ids'
import { BLOCKER_RANGE, ITEM_INFO } from '@/domain/items'
import { adjacency, rockTiles, tilesWithin, Walks } from '@/domain/paths'
import type { Item } from '@/domain/vocabulary'
import { useApiClient } from './apiClient'
import { useDevStore } from './dev'
import { useGameStore } from './game'

const CODE_KEY = 'tweetea.teamCode'

/** An item waiting for the player to pick what it is used on. */
export type Targeting = { item: Item; kind: 'team' | 'tile' }

/**
 * The team this browser manages, if someone entered a team code: its actions, the route being
 * picked on the map, and an item waiting for a target.
 */
export const useTeamStore = defineStore('team', () => {
  const api = useApiClient()
  const game = useGameStore()
  const now = useNow({ scheduler: (tick) => useIntervalFn(tick, 5_000) })

  const code = ref<string | null>(null)
  const teamId = ref<TeamId | null>(null)
  const pending = ref(false)
  const error = ref<string | null>(null)

  /** The route shown on the map; `locked` once clicked or tapped, so hovering stops changing it. */
  const route = shallowRef<TileId[] | null>(null)
  const routeLocked = ref(false)
  const targeting = ref<Targeting | null>(null)
  /** The captain chose to draw without using a power-up on this tile. */
  const skippedPowerup = ref(false)
  /**
   * The card pick on screen: `picking` from the click until the server answers and the card flips,
   * `revealed` while the result is shown. It outlives the team's status, which turns `drawn` as
   * soon as the server answers, so the reveal is not cut short.
   */
  const drawPhase = ref<'idle' | 'picking' | 'revealed'>('idle')
  const lastDraw = shallowRef<DrawOutcome | null>(null)

  const team = computed<Team | null>(() =>
    teamId.value === null ? null : (game.state?.teams.get(teamId.value) ?? null),
  )

  const adj = computed(() => (game.board ? adjacency(game.board.roads) : new Map()))

  /** The walks open to the team after a draw. */
  /**
   * Rocks still standing, as a string so it only changes when a rock appears or expires. The clock
   * ticks every few seconds; without this the search and the map's rings would redo themselves
   * on every tick.
   */
  const rockKey = computed(() =>
    game.state ? [...rockTiles(game.state, now.value)].sort((a, b) => a - b).join(',') : '',
  )

  const walks = computed(() => {
    const t = team.value
    if (!t || t.status.kind !== 'drawn' || !game.state || t.frozenUntil || t.matchId !== null)
      return null
    const rocks = new Set(
      rockKey.value ? rockKey.value.split(',').map((r) => tileId(Number(r))) : [],
    )
    return new Walks(adj.value, rocks, t.position, t.status.length)
  })
  const reach = computed(() => walks.value?.reach() ?? null)

  /** Tiles a tile-targeted item may go on: in range, not a shop, free of teams, gems and blockers. */
  const targetableTiles = computed(() => {
    const t = team.value
    const state = game.state
    const board = game.board
    if (!t || !state || !board || targeting.value?.kind !== 'tile') return null
    const occupied = new Set([...state.teams.values()].map((x) => x.position))
    const gems = new Set(state.gemTiles.values())
    const tiles = tilesWithin(adj.value, t.position, BLOCKER_RANGE)
    for (const tile of tiles) {
      const kind = board.tiles.get(tile)?.kind
      if (kind !== 'normal' && kind !== 'red') tiles.delete(tile)
      else if (occupied.has(tile) || gems.has(tile) || state.blockers.has(tile)) tiles.delete(tile)
    }
    return tiles
  })

  // A new draw, an item that changes the length, or a move all make the shown route stale.
  watch(
    () => {
      const t = team.value
      return t ? `${t.status.kind}:${t.position}:${walks.value?.length ?? ''}` : ''
    },
    () => clearRoute(),
  )
  watch(
    () => team.value?.status.kind,
    (kind) => {
      if (kind !== 'ready') skippedPowerup.value = false
      // The draw was undone (dev tools): the reveal no longer matches the team.
      if (kind === 'ready' && drawPhase.value === 'revealed') finishDraw()
    },
  )

  async function login(entered: string) {
    const trimmed = entered.trim()
    if (!trimmed) return
    pending.value = true
    error.value = null
    try {
      const identity = await api.identifyTeam(trimmed)
      code.value = trimmed
      teamId.value = identity.teamId
      try {
        localStorage.setItem(CODE_KEY, trimmed)
      } catch {
        // Storage can be blocked; the login still works for this visit.
      }
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      pending.value = false
    }
  }

  /** Logs back in with the code from an earlier visit, if there is one. */
  async function restore() {
    if (code.value) return
    let saved: string | null = null
    try {
      saved = localStorage.getItem(CODE_KEY)
    } catch {
      return
    }
    if (!saved) return
    await login(saved)
    if (teamId.value === null) forget()
  }

  function logout() {
    code.value = null
    teamId.value = null
    error.value = null
    clearRoute()
    targeting.value = null
    finishDraw()
    forget()
  }

  function forget() {
    try {
      localStorage.removeItem(CODE_KEY)
    } catch {
      // Nothing to clean up.
    }
  }

  /** Sends a command for the team; resolves to the journal seq it produced, or null if refused. */
  async function act(command: TeamCommand): Promise<number | null> {
    const t = team.value
    if (!t || !code.value || pending.value) return null
    pending.value = true
    error.value = null
    try {
      const accepted = await api.sendTeamCommand({
        teamCode: code.value,
        version: t.version,
        command,
        idempotencyKey: crypto.randomUUID(),
      })
      await game.refreshState()
      return accepted.seq
    } catch (e) {
      error.value = messageOf(e)
      if (isApiError(e) && e.problem.kind === 'stale_version') await game.refreshState()
      return null
    } finally {
      pending.value = false
    }
  }

  /**
   * Draws a card and reports what came of it, read from the journal entry the draw produced so the
   * reveal shows exactly what the server dealt (free item, Joker, boot).
   */
  async function draw(): Promise<DrawOutcome | null> {
    const id = team.value?.id
    if (id === undefined) return null
    const seq = await sendDraw(id)
    if (seq === null) return null
    const entry = await waitForEntry(seq)
    const outcome = entry ? drawOutcome(entry, id) : null
    if (outcome) return outcome
    // No entry (offline fixtures or a slow stream): fall back to what the state says.
    const status = team.value?.status
    return status?.kind === 'drawn'
      ? {
          card: status.card,
          steps: status.steps,
          freeItem: null,
          suitGold: 0,
          joker: null,
          restarted: false,
        }
      : null
  }

  /** The captain picked a face-down card. */
  async function pickCard() {
    if (drawPhase.value !== 'idle') return
    drawPhase.value = 'picking'
    lastDraw.value = null
    const outcome = await draw()
    if (outcome) lastDraw.value = outcome
    else drawPhase.value = 'idle'
  }

  /** The picked card has flipped over. */
  function cardRevealed() {
    if (drawPhase.value === 'picking') drawPhase.value = 'revealed'
  }

  function finishDraw() {
    drawPhase.value = 'idle'
    lastDraw.value = null
  }

  /** A real draw, or the dev tools' rigged card when one is set (play-testing). */
  async function sendDraw(id: TeamId): Promise<number | null> {
    const dev = useDevStore()
    const card = dev.enabled ? dev.riggedCard : null
    if (!card) return act({ kind: 'draw' })
    dev.teamId = id
    const seq = await dev.drawCard(card)
    if (seq !== null) dev.riggedCard = null
    else error.value = dev.message?.text ?? 'The rigged draw failed.'
    return seq
  }

  function waitForEntry(seq: number, timeoutMs = 4000): Promise<JournalEntry | null> {
    const find = () => game.log.find((entry) => entry.seq === seq) ?? null
    const found = find()
    if (found) return Promise.resolve(found)
    return new Promise((resolve) => {
      const stop = watch(
        () => game.log,
        () => {
          const entry = find()
          if (!entry) return
          stop()
          clearTimeout(timer)
          resolve(entry)
        },
      )
      const timer = setTimeout(() => {
        stop()
        resolve(null)
      }, timeoutMs)
    })
  }

  /** Shows the walk the pointer points at: one ending on the tile if possible, else one through it. */
  function previewRoute(tile: TileId, lock = false) {
    const w = walks.value
    if (!w || (routeLocked.value && !lock)) return
    const path = w.endingAt(tile) ?? w.through(tile)
    if (!path) return
    route.value = path
    routeLocked.value = lock
  }

  function clearRoute() {
    route.value = null
    routeLocked.value = false
  }

  async function confirmRoute() {
    if (!route.value) return
    if ((await act({ kind: 'confirm_path', path: route.value })) !== null) clearRoute()
  }

  /** Uses an item at once, or waits for a target if it needs one. */
  async function useItem(item: Item) {
    const kind = ITEM_INFO[item].target
    if (kind === 'none') return void (await act({ kind: 'use_item', item }))
    targeting.value = { item, kind }
  }

  async function useOn(target: ItemTarget) {
    const t = targeting.value
    if (!t) return
    if ((await act({ kind: 'use_item', item: t.item, target })) !== null) targeting.value = null
  }

  return {
    code,
    teamId,
    team,
    pending,
    error,
    route,
    routeLocked,
    targeting,
    walks,
    reach,
    targetableTiles,
    login,
    restore,
    logout,
    act,
    skippedPowerup,
    drawPhase,
    lastDraw,
    pickCard,
    cardRevealed,
    finishDraw,
    previewRoute,
    clearRoute,
    confirmRoute,
    useItem,
    useOn,
  }
})

function messageOf(error: unknown): string {
  if (isApiError(error)) return describeProblem(error.problem)
  return error instanceof Error ? error.message : String(error)
}
