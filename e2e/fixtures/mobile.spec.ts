import { test, expect, type Page } from '@playwright/test'

// The site on a phone (an iPhone 13's screen), on the recorded game: the header folds into a menu,
// the board keeps the screen and its panel is a bottom sheet.
test.use({
  viewport: { width: 390, height: 664 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
})

async function open(page: Page, path: string) {
  await page.addInitScript(() => {
    localStorage.setItem('tweetea.tutorial', '1')
    localStorage.setItem('tweetea.dinkSetup', '1')
  })
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

/** More than half the screen's height. */
const MOSTLY_MAP = 664 / 2

const mapHeight = (page: Page) =>
  page.evaluate(() => document.querySelector('.leaflet-container')?.getBoundingClientRect().height)

const scrollsSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

test('the menu reaches every page, and none scrolls sideways', async ({ page }) => {
  await open(page, '/')
  for (const [label, url] of [
    ['Stats', /\/stats$/],
    ['Teams', /\/teams$/],
    ['Characters', /\/characters$/],
    ['Items', /\/items$/],
    ['FAQ', /\/faq$/],
    ['Board', /\/$/],
  ] as const) {
    await page.getByRole('button', { name: 'Open the menu' }).click()
    await page
      .getByRole('navigation', { name: 'Pages' })
      .getByRole('button', { name: label })
      .click()
    await expect(page).toHaveURL(url)
    // Going to a page closes the menu.
    await expect(page.getByRole('navigation', { name: 'Pages' })).toBeHidden()
    expect(await scrollsSideways(page), `${label} scrolls sideways`).toBe(false)
  }
})

test('the board is the map, and the panel is a scroll away below it', async ({ page }) => {
  await open(page, '/')
  // Most of the screen is map, with the tabs showing at the bottom.
  await expect.poll(() => mapHeight(page)).toBeGreaterThan(MOSTLY_MAP)
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeInViewport()
  // Nothing but the map's own buttons on top of it.
  await expect(page.getByText('Following')).toBeHidden()
  await expect(page.getByText('Free roam')).toBeHidden()

  // Scrolling down brings the panel up, and the map keeps its size.
  const before = await mapHeight(page)
  await page.getByText('Current tile').scrollIntoViewIfNeeded()
  await expect(page.getByText('Current tile')).toBeInViewport()
  expect(await mapHeight(page)).toBe(before)

  // The tabs switch what is below.
  await page.getByRole('tab', { name: 'Log' }).click()
  await expect(page.getByText('Current tile')).toBeHidden()
  expect(await scrollsSideways(page)).toBe(false)
})

test('a tap on a tile shows its task, and stays up', async ({ page }) => {
  await open(page, '/')
  // The recorded game follows no team, so the camera stays put under the finger.
  await expect.poll(() => page.evaluate(() => window.__tweeteaMap?.still() ?? false)).toBe(true)

  // A node clear of the map's bars and buttons.
  const tile = await page.evaluate(() => {
    const map = document.querySelector('.leaflet-container')
    if (!map || !window.__tweeteaMap) return null
    const box = map.getBoundingClientRect()
    for (let t = 0; t < 1000; t++) {
      const at = window.__tweeteaMap.point(t)
      if (!at || at.y < box.top + 120 || at.y > box.bottom - 80) continue
      if (at.x < box.left + 40 || at.x > box.right - 40) continue
      const hit = document.elementFromPoint(at.x, at.y)
      if (hit && map.contains(hit)) return t
    }
    return null
  })
  expect(tile, 'a node clear of the overlays').not.toBeNull()
  await expect.poll(() => page.evaluate(() => window.__tweeteaMap?.still() ?? false)).toBe(true)
  const at = await page.evaluate((t) => window.__tweeteaMap?.point(t) ?? null, tile ?? 0)
  expect(at, `tile ${tile} on the map`).not.toBeNull()
  await page.touchscreen.tap(at?.x ?? 0, at?.y ?? 0)
  // A tap is a move and then a click, and Leaflet closes tooltips on a click: once the tap is over
  // the card must still be up.
  await expect(page.locator('.tile-tip')).toBeVisible()
})
