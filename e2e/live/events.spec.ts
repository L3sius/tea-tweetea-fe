import { TEAMS, expect, open, test } from '../support/live'

const [red] = TEAMS

test('a death from Dink shows in the activity feed', async ({ page, backend }) => {
  await open(page)
  await page.getByRole('tab', { name: 'Activity' }).click()
  await backend.dink({
    type: 'DEATH',
    playerName: red.rsn,
    extra: { killerName: 'Vorkath', isPvp: false },
  })
  await expect(page.getByText(/killed by Vorkath/)).toBeVisible()
})

test('a frozen team can only wait, until it thaws', async ({ page, backend, devTools }) => {
  void devTools
  await backend.admin({ action: 'complete_tile', team: red.id })
  await open(page, red)
  await page.getByRole('tab', { name: 'Play' }).click()
  await expect(page.getByRole('button', { name: /^Face-down card/ }).first()).toBeVisible()

  await backend.admin({ action: 'dev_freeze', team: red.id, hours: 1 })
  await expect(page.getByText(/^Frozen until/)).toBeVisible()
  await expect(page.getByRole('button', { name: /^Face-down card/ })).toHaveCount(0)

  await backend.admin({ action: 'dev_thaw', team: red.id })
  await expect(page.getByText(/^Frozen until/)).toBeHidden()
  await expect(page.getByRole('button', { name: /^Face-down card/ }).first()).toBeVisible()
})

test('a rigged Joker shows its effect on the reveal', async ({ page, backend, devTools }) => {
  void devTools
  await backend.admin({ action: 'complete_tile', team: red.id })
  await open(page, red)
  await page.getByRole('tab', { name: 'Play' }).click()

  // The play-testing tools rig the next pick; the draw itself is the normal one.
  await page.getByRole('button', { name: 'Dev' }).click()
  const tools = page.getByRole('region', { name: 'Dev tools' })
  await tools.getByLabel('Suit').selectOption('joker')
  await tools.getByRole('button', { name: 'Rig my next pick' }).click()
  await page.getByRole('button', { name: /^Dev/ }).click()

  await page
    .getByRole('button', { name: /^Face-down card/ })
    .last()
    .click()
  await expect(page.getByText(/^Joker! Your team/)).toBeVisible()
})
