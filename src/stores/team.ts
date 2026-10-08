import { useIntervalFn, useNow } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { describeProblem, isApiError } from '@/api'
import type { ItemTarget, TeamCommand } from '@/domain/commands'
import { drawOutcome, type DrawOutcome } from '@/domain/draw'
import type { GameEvent, JournalEntry } from '@/domain/events'
import type { Team } from '@/domain/game'
import { tileId, type TeamId, type TileId } from '@/domain/ids'
import { BLOCKER_RANGE, ITEM_TARGET, gainedItem } from '@/domain/items'
import { adjacency, webTiles, sharedLength, tilesWithin, Walks } from '@/domain/paths'
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
  /** The team's inventory. It is private, so it comes from `/team/me` rather than the state. */
  const items = shallowRef<ReadonlyMap<Item, number>>(new Map())
  /** The journal entry `items` is current to. */
  let itemsSeq = 0
  const pending = ref(false)
  const error = ref<string | null>(null)

  /**
   * The walk the captain is building, start tile first. It changes by clicking checkpoints;
   * `checkpoints` holds the route's length after each one, so Undo removes a whole checkpoint.
   */
  const route = shallowRef<TileId[] | null>(null)
  const checkpoints = shallowRef<number[]>([])
  /** The route a click on the hovered node would leave; null when not hovering a node. */
  const preview = shallowRef<TileId[] | null>(null)
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

  // Item names are private to their team: the game's texts name them only for this browser's team.
  watch(teamId, (id) => (game.viewer = id), { immediate: true })

  const team = computed<Team | null>(() =>
    teamId.value === null ? null : (game.state?.teams.get(teamId.value) ?? null),
  )

  const adj = computed(() => (game.board ? adjacency(game.board.roads) : new Map()))

  /** The walks open to the team after a draw. */
  /**
   * Webs still standing, as a string so it only changes when a web appears or expires. The clock
   * ticks every few seconds; without this the search and the map's rings would redo themselves
   * on every tick.
   */
  const webKey = computed(() =>
    game.state ? [...webTiles(game.state, now.value)].sort((a, b) => a - b).join(',') : '',
  )

  const walks = computed(() => {
    const t = team.value
    if (!t || t.status.kind !== 'drawn' || !game.state || t.frozenUntil || t.matchId !== null)
      return null
    const webs = new Set(webKey.value ? webKey.value.split(',').map((r) => tileId(Number(r))) : [])
    return new Walks(adj.value, webs, t.position, t.status.length)
  })
  /** The route so far, or just the start tile before the first checkpoint. */
  const path = computed<TileId[] | null>(() => {
    const w = walks.value
    return w ? (route.value ?? [w.start]) : null
  })
  const stepsLeft = computed(() =>
    walks.value && path.value ? walks.value.stepsLeft(path.value) : 0,
  )
  /** Where the next checkpoint can go. */
  const options = computed(() =>
    walks.value && path.value ? walks.value.options(path.value) : null,
  )

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

  /** Refetches the inventory; a failure keeps the last one, as the state refreshes do. */
  async function refreshItems() {
    const entered = code.value
    if (!entered) return
    try {
      const me = await api.getMe(entered)
      if (code.value !== entered) return
      items.value = me.items
      itemsSeq = me.seq
    } catch {
      // The next change that names the team tries again.
    }
  }

  // The journal says when the team's inventory changed but not how (the items are private), so a
  // newer entry with such an event for the team means asking again.
  watch(
    () => game.log,
    (log) => {
      const id = teamId.value
      if (id === null) return
      const changed = log.some(
        (entry) =>
          entry.seq > itemsSeq &&
          entry.events.some(
            (e) => INVENTORY_EVENTS.has(e.kind) && 'teamId' in e && e.teamId === id,
          ),
      )
      if (changed) itemsRefresh()
    },
  )
  let itemsTimer: ReturnType<typeof setTimeout> | undefined
  /** Entries come in bursts, so wait for a quiet moment as the game store does. */
  function itemsRefresh() {
    clearTimeout(itemsTimer)
    itemsTimer = setTimeout(() => void refreshItems(), 300)
  }

  async function login(entered: string) {
    const trimmed = entered.trim()
    if (!trimmed) return
    pending.value = true
    error.value = null
    try {
      const me = await api.getMe(trimmed)
      code.value = trimmed
      teamId.value = me.teamId
      items.value = me.items
      itemsSeq = me.seq
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
    items.value = new Map()
    itemsSeq = 0
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
      await Promise.all([game.refreshState(), refreshItems()])
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
   * reveal shows exactly what the server dealt (free item, Joker, suit gold).
   */
  async function draw(): Promise<DrawOutcome | null> {
    const id = team.value?.id
    if (id === undefined) return null
    const before = items.value
    const seq = await sendDraw(id)
    if (seq === null) return null
    const entry = await waitForEntry(seq)
    const outcome = entry ? drawOutcome(entry, id) : null
    // The journal keeps the free item private, even from its team: the inventory says which it was.
    if (outcome?.freeItem && outcome.freeItem.item === null) {
      await refreshItems()
      outcome.freeItem.item = gainedItem(before, items.value)
    }
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

  /** Shows the route a click on `tile` would leave, or nothing when the pointer isn't on a node. */
  function previewTo(tile: TileId | null) {
    const w = walks.value
    const from = path.value
    const next = w && from && tile !== null ? w.walkTo(from, tile) : null
    preview.value = next && from && !sameRoute(next, from) ? next : null
  }

  /**
   * A click on a node: the walk goes there the shortest way and it becomes a checkpoint. Steps
   * that go back along the route take those steps off it, so walking back is how to undo.
   */
  function checkpoint(tile: TileId) {
    const w = walks.value
    const from = path.value
    const next = w && from ? w.walkTo(from, tile) : null
    if (!next || !from || sameRoute(next, from)) return
    if (next.length === 1) return clearRoute()
    const kept = sharedLength(from, next)
    route.value = next
    checkpoints.value = [
      ...checkpoints.value.filter((n) => n <= kept && n !== next.length),
      next.length,
    ]
    preview.value = null
  }

  /** Removes the last checkpoint and the stretch leading to it. */
  function undoCheckpoint() {
    const kept = checkpoints.value.slice(0, -1)
    const length = kept.at(-1)
    checkpoints.value = kept
    route.value = length === undefined ? null : (route.value?.slice(0, length) ?? null)
    preview.value = null
  }

  function clearRoute() {
    route.value = null
    checkpoints.value = []
    preview.value = null
  }

  async function confirmRoute() {
    if (!route.value || stepsLeft.value !== 0) return
    if ((await act({ kind: 'confirm_path', path: route.value })) !== null) clearRoute()
  }

  /** Uses an item at once, or waits for a target if it needs one. */
  async function useItem(item: Item) {
    const kind = ITEM_TARGET[item]
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
    items,
    pending,
    error,
    route,
    path,
    checkpoints,
    preview,
    stepsLeft,
    options,
    targeting,
    walks,
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
    previewTo,
    checkpoint,
    undoCheckpoint,
    clearRoute,
    confirmRoute,
    useItem,
    useOn,
  }
})

/** Events after which a team's inventory may differ. */
const INVENTORY_EVENTS = new Set<GameEvent['kind']>(['bought', 'item_gained', 'item_lost'])

const sameRoute = (a: readonly TileId[], b: readonly TileId[]) =>
  a.length === b.length && sharedLength(a, b) === a.length

function messageOf(error: unknown): string {
  if (isApiError(error)) return describeProblem(error.problem)
  return error instanceof Error ? error.message : String(error)
}
