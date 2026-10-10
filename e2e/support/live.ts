// Support for the live tests: a fresh tweety game per test (scripts/e2e-backend.mjs), its API in
// the wire format, and the page set up as a viewer or a team captain.
import {
  test as base,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test'

export const API = 'http://127.0.0.1:8090'
const CONTROL = 'http://127.0.0.1:8091'
export const ADMIN_CODE = 'admin'

/** The seeded teams, in id order. Codes equal the lower-case names, as in tweety's demo seed. */
export const TEAMS = [
  { id: 0, name: 'Red', code: 'red', member: 'red-one', rsn: 'red-alt' },
  { id: 1, name: 'Blue', code: 'blue', member: 'blue-one', rsn: 'blue-alt' },
] as const

/** The parts of `/state` the tests read, as the server sends them. */
export type WireTeam = {
  id: number
  name: string
  position: number
  status: { status: string; [key: string]: unknown }
  frozen_until: string | null
  gems: unknown[]
  gold: number
  version: number
}
export type WireState = {
  seq: number
  phase: string
  teams: WireTeam[]
  shops: Record<string, unknown>
  blockers: Record<string, unknown>
}

export class Backend {
  constructor(private readonly request: APIRequestContext) {}

  async state(): Promise<WireState> {
    return (await this.request.get(`${API}/state`)).json()
  }

  async team(id: number): Promise<WireTeam> {
    const team = (await this.state()).teams.find((t) => t.id === id)
    if (!team) throw new Error(`no team ${id}`)
    return team
  }

  async board(): Promise<{ tiles: { id: number; kind: string }[] }> {
    return (await this.request.get(`${API}/board`)).json()
  }

  /** Tiles of these kinds: `normal`, `red` (a minigame) or `shop`. */
  async tilesOf(...kinds: string[]): Promise<Set<number>> {
    const { tiles } = await this.board()
    return new Set(tiles.filter((t) => kinds.includes(t.kind)).map((t) => t.id))
  }

  /** Sends an admin action and fails the test if the server refuses it. */
  async admin(action: Record<string, unknown>): Promise<void> {
    const response = await this.request.post(`${API}/admin/action`, {
      headers: { 'X-Admin-Code': ADMIN_CODE },
      data: action,
    })
    expect(response.ok(), `${action.action}: ${await response.text()}`).toBe(true)
  }

  /** Sends a team action at the team's current version, as the site does. */
  async act(team: (typeof TEAMS)[number], action: Record<string, unknown>): Promise<void> {
    const { version } = await this.team(team.id)
    const response = await this.request.post(`${API}/team/action`, {
      headers: { 'X-Team-Code': team.code },
      data: { ...action, version, key: crypto.randomUUID() },
    })
    expect(response.ok(), `${action.action}: ${await response.text()}`).toBe(true)
  }

  /** Posts a notification as the Dink plugin does: multipart, with the JSON in `payload_json`. */
  async dink(payload: { type: string; playerName: string; extra: Record<string, unknown> }) {
    const response = await this.request.post(`${API}/dink`, {
      multipart: { payload_json: JSON.stringify(payload) },
    })
    expect(response.ok(), await response.text()).toBe(true)
  }

  /** Each team with a member and an alt account, in the order tweety needs them, then the start. */
  async seed() {
    for (const t of TEAMS) {
      await this.admin({ action: 'create_team', name: t.name, code: t.code })
      await this.admin({ action: 'add_member', team: t.id, name: t.member })
      await this.admin({ action: 'add_account', team: t.id, member: t.member, rsn: t.rsn })
    }
    await this.admin({ action: 'start_game' })
  }

  /**
   * Whether tweety has the play-testing admin actions (DEV_TOOLS=1, and a tweety that knows them).
   * A dev action on a team that doesn't exist is refused either way; the reason tells which.
   */
  async hasDevTools(): Promise<boolean> {
    const response = await this.request.post(`${API}/admin/action`, {
      headers: { 'X-Admin-Code': ADMIN_CODE },
      data: { action: 'dev_thaw', team: 999 },
    })
    const text = await response.text()
    return response.status() !== 403 && !text.includes('unknown variant')
  }
}

type Fixtures = {
  /** The API of a fresh game with the seeded teams, already started. */
  backend: Backend
  /** Skips the test when tweety lacks the play-testing admin actions it needs. */
  devTools: undefined
  /** Opens a page in a browser of its own (another player), closed after the test. */
  otherPage: () => Promise<Page>
}

export const test = base.extend<Fixtures>({
  backend: async ({ request }, use) => {
    const reset = await request.post(`${CONTROL}/reset`)
    if (reset.status() === 503) test.skip(true, await reset.text())
    expect(reset.ok(), await reset.text()).toBe(true)
    const backend = new Backend(request)
    await backend.seed()
    await use(backend)
  },
  devTools: async ({ backend }, use) => {
    test.skip(
      !(await backend.hasDevTools()),
      'tweety has no play-testing admin actions (dev_give_item, dev_teleport, ...); see docs/e2e.md',
    )
    await use(undefined)
  },
  otherPage: async ({ browser }, use) => {
    const contexts: BrowserContext[] = []
    await use(async () => {
      const context = await browser.newContext()
      contexts.push(context)
      return context.newPage()
    })
    for (const context of contexts) await context.close()
  },
})

export { expect }

/** Opens the site with the tutorial already seen, as a viewer or logged in as a team's captain. */
export async function open(page: Page, as?: (typeof TEAMS)[number], path = '/') {
  await page.addInitScript((code) => {
    localStorage.setItem('tweetea.tutorial', '1')
    if (code) localStorage.setItem('tweetea.teamCode', code)
  }, as?.code ?? null)
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

/**
 * Clicks a node on the board map (see MapProbe in env.d.ts). Says where it clicked and what was
 * there, for the message when the click did not do what it should.
 */
export async function clickTile(page: Page, tile: number): Promise<string> {
  const still = () => page.evaluate(() => window.__tweeteaMap?.still() ?? false)
  await expect.poll(still, { message: 'the map stops moving' }).toBe(true)
  const point = await page.evaluate((t) => window.__tweeteaMap?.point(t) ?? null, tile)
  // Centring the node pans the map, which takes a moment even without animation.
  await expect.poll(still, { message: 'the map stops moving' }).toBe(true)
  if (!point) throw new Error(`tile ${tile} is not on the map`)
  const under = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y)
    return el ? `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}` : 'nothing'
  }, point)
  await page.mouse.click(point.x, point.y)
  return `tile ${tile} at (${Math.round(point.x)}, ${Math.round(point.y)}), on ${under}`
}

/** The "Steps left" box of the walk step. */
async function stepsLeft(page: Page): Promise<number> {
  const box = page.getByText('Steps left', { exact: true }).locator('..')
  const text = (await box.textContent()) ?? ''
  const left = text.match(/(\d+)\s*$/)?.[1]
  if (left === undefined) throw new Error(`no step count in "${text}"`)
  return Number(left)
}

/**
 * Zooms the map in, so a click lands on the node meant and not a neighbour. Following a team
 * stops first: the camera would pull back to the team whenever the probe pans to a node.
 */
export async function zoomIn(page: Page) {
  const stop = page.getByRole('button', { name: 'Stop', exact: true })
  if (await stop.isVisible()) await stop.click()
  await page.getByRole('button', { name: 'Show the map controls' }).click()
  const zoom = page.getByRole('button', { name: 'Zoom in' })
  for (let i = 0; i < 2; i++) await zoom.click()
  await page.getByRole('button', { name: 'Hide the map controls' }).click()
}

/**
 * Builds a walk from `start` one step at a time, never back onto a tile already on it, until the
 * card is used up. Then walks it. Tiles in `avoid` (shops, minigames) are taken only when there
 * is no other way on.
 */
export async function walkTheCard(
  page: Page,
  start: number,
  avoid: ReadonlySet<number> = new Set(),
) {
  await zoomIn(page)
  const walked = new Set([start])
  for (let left = await stepsLeft(page); left > 0; left--) {
    const options = await page.evaluate(() => window.__tweeteaMap?.options() ?? null)
    const open = options?.near.filter((t) => !walked.has(t)) ?? []
    const next = open.find((t) => !avoid.has(t)) ?? open[0]
    if (next === undefined) throw new Error(`no step onward from ${[...walked].join(' > ')}`)
    walked.add(next)
    const clicked = await clickTile(page, next)
    await expect.poll(() => stepsLeft(page), { message: `a click on ${clicked}` }).toBe(left - 1)
  }
  const go = page.getByRole('button', { name: 'Go!' })
  await expect(go).toBeEnabled()
  await go.click()
}

/** Waits for a walk to end, walking on past any shop it stops at, until the next tile's task. */
export async function finishWalk(page: Page) {
  const step = page.getByRole('list', { name: 'Your turn' }).locator('[aria-current="step"]')
  const walkOn = page.getByRole('button', { name: 'Walk on' })
  await expect(async () => {
    if (await walkOn.isVisible()) await walkOn.click()
    await expect(step).toHaveText(/^Tile/, { timeout: 1000 })
  }).toPass({ timeout: 60_000 })
}
