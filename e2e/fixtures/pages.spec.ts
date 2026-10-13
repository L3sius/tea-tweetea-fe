import { test, expect, type Page } from '@playwright/test'

/** Opens a page with the tutorial already seen, collecting the errors it logs. */
async function open(page: Page, path: string) {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('tweetea.tutorial', '1'))
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  return errors
}

const PAGES = [
  { path: '/', shows: 'Current tile' },
  { path: '/stats', shows: 'By team' },
  { path: '/teams', shows: 'Varrock Sewer Rats' },
  { path: '/items', shows: 'Mystery box' },
]

for (const { path, shows } of PAGES) {
  test(`${path} shows the recorded game without errors`, async ({ page }) => {
    const errors = await open(page, path)
    await expect(page.getByText(shows).first()).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('the header goes to every page', async ({ page }) => {
  await open(page, '/')
  const nav = page.getByRole('navigation', { name: 'Pages' })
  for (const [label, url] of [
    ['Stats', /\/stats$/],
    ['Teams', /\/teams$/],
    ['Items', /\/items$/],
    ['Board', /\/$/],
  ] as const) {
    await nav.getByRole('button', { name: label }).click()
    await expect(page).toHaveURL(url)
    await expect(nav.getByRole('button', { name: label })).toHaveAttribute('aria-current', 'page')
  }
})

test('a captain logs in with the team code, and out again', async ({ page }) => {
  await open(page, '/')
  await page.getByRole('tab', { name: 'Play' }).click()

  await page.getByLabel('Team code').fill('not-a-code')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toBeVisible()

  await page.getByLabel('Team code').fill('red')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('Team Varrock Sewer Rats')).toBeVisible()
  await expect(page.getByTitle('Playing as Varrock Sewer Rats')).toBeVisible()

  // The code is remembered for the next visit.
  await page.reload()
  await expect(page.getByTitle('Playing as Varrock Sewer Rats')).toBeVisible()

  await page.getByRole('button', { name: 'Log out' }).click()
  await page.getByRole('tab', { name: 'Play' }).click()
  await expect(page.getByLabel('Team code')).toBeVisible()
})

test('the Actions camera option is remembered', async ({ page }) => {
  await open(page, '/')
  const actions = page.getByRole('button', { name: 'Actions' }).first()
  await expect(actions).toHaveAttribute('aria-pressed', 'false')
  await actions.click()
  await expect(actions).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Actions' }).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

/** Fails when anything is drawn over the open hover box: its corners and middle must be its own. */
async function expectTooltipOnTop(page: Page) {
  const tip = page.getByRole('tooltip')
  await expect(tip).toBeVisible()
  const covered = await tip.evaluate((box) => {
    // The box lets the pointer through, which hit-testing would skip; take hits for the check.
    box.style.pointerEvents = 'auto'
    const r = box.getBoundingClientRect()
    const inset = 4
    const points: [number, number][] = [
      [r.left + inset, r.top + inset],
      [r.right - inset, r.top + inset],
      [r.left + inset, r.bottom - inset],
      [r.right - inset, r.bottom - inset],
      [r.left + r.width / 2, r.top + r.height / 2],
    ]
    const hidden = points
      .filter(([x, y]) => !box.contains(document.elementFromPoint(x, y)))
      .map(([x, y]) => `${Math.round(x)},${Math.round(y)}`)
    box.style.pointerEvents = ''
    return hidden
  })
  expect(covered, 'points of the hover box drawn over by something else').toEqual([])
}

test('hover boxes show whole, over the header and panels', async ({ page }) => {
  // Wide enough that the map's buttons fit on one row, so the Actions box rises into the header.
  await page.setViewportSize({ width: 1920, height: 1080 })
  await open(page, '/')
  await page.getByRole('button', { name: 'Actions' }).first().hover()
  await expect(page.getByRole('tooltip')).toContainText('The camera visits')
  const tip = await page.getByRole('tooltip').boundingBox()
  const header = await page.getByRole('banner').boundingBox()
  expect(tip && header && tip.y < header.y + header.height, 'the box reaches into the header').toBe(
    true,
  )
  await expectTooltipOnTop(page)

  await page.getByRole('tab', { name: 'Activity' }).click()
  await page.locator('ol time').first().hover()
  await expectTooltipOnTop(page)
})

test('the log and activity tabs list the recorded game', async ({ page }) => {
  await open(page, '/')
  await page.getByRole('tab', { name: 'Log' }).click()
  await expect(page.getByText(/drew|set off|landed/).first()).toBeVisible()
  await page.getByRole('tab', { name: 'Activity' }).click()
  await expect(page.getByLabel('Player name')).toBeHidden()
  await page.getByRole('button', { name: 'Filter' }).click()
  await expect(page.getByLabel('Player name')).toBeVisible()
})
