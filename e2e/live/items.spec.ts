import { TEAMS, clickTile, expect, open, test, zoomIn } from '../support/live'

const [red, blue] = TEAMS

test.beforeEach(async ({ backend, devTools }) => {
  void devTools
  // Items are used after the tile is done and before the draw.
  await backend.admin({ action: 'complete_tile', team: red.id })
})

test('Ice Barrage freezes a rival, who sees it on their own page', async ({
  page,
  otherPage,
  backend,
}) => {
  await backend.admin({ action: 'dev_give_item', team: red.id, item: 'ice_barrage' })
  const rival = await otherPage()
  await open(rival, blue)
  await rival.getByRole('tab', { name: 'Play' }).click()

  await open(page, red)
  await page.getByRole('tab', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'Ice Barrage' }).first().click()
  await page.getByRole('menuitem', { name: /^Use/ }).click()
  // The rival is picked in the panel (the map has a button per team too).
  const using = page.getByRole('status').filter({ hasText: 'Using Ice Barrage' })
  await using.getByRole('button', { name: blue.name }).click()
  await page
    .getByRole('alertdialog', { name: 'Use item' })
    .getByRole('button', { name: 'Yes' })
    .click()

  await expect.poll(async () => (await backend.team(blue.id)).frozen_until).not.toBeNull()
  await expect(rival.getByText(/^Frozen until/)).toBeVisible()
  // The item is used up.
  await expect(page.getByRole('button', { name: 'Ice Barrage' })).toHaveCount(0)
})

test('a banana goes on a tile picked on the map', async ({ page, backend }) => {
  await backend.admin({ action: 'dev_give_item', team: red.id, item: 'banana' })
  await open(page, red)
  await page.getByRole('tab', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'Banana' }).first().click()
  await page.getByRole('menuitem', { name: /^Use/ }).click()
  await expect(page.getByText(/Click one of the orange-ringed tiles/)).toBeVisible()

  await zoomIn(page)
  const targets = await page.evaluate(() => window.__tweeteaMap?.targets() ?? [])
  expect(targets, 'tiles the banana can go on').not.toHaveLength(0)
  const tile = targets[0] ?? -1
  await clickTile(page, tile)
  await page
    .getByRole('alertdialog', { name: 'Use item' })
    .getByRole('button', { name: 'Yes' })
    .click()

  await expect
    .poll(async () => Object.keys((await backend.state()).blockers))
    .toContain(String(tile))
})

test('a mystery box from a shop lands in the inventory', async ({ page, backend }) => {
  const [shop] = await backend.tilesOf('shop')
  await backend.admin({ action: 'dev_teleport', team: red.id, tile: shop })
  await backend.admin({ action: 'adjust_gold', team: red.id, delta: 200 })

  await open(page, red)
  await page.getByRole('tab', { name: 'Play' }).click()
  await page.getByRole('button', { name: "You're on a shop: browse it" }).click()
  await page.getByRole('button', { name: 'Mystery box' }).click()
  await page.getByRole('button', { name: /^Buy for \d+ gold$/ }).click()

  // The reel spins first, then names the item, which is now in the inventory.
  await expect(page.getByText(/^You got the /)).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Close shop' }).click()
  await expect(page.getByText(/Inventory \(1\//)).toBeVisible()
})
