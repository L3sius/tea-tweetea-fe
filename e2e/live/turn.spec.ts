import { TEAMS, expect, finishWalk, open, test, walkTheCard } from '../support/live'

const red = TEAMS[0]

test('a captain plays a whole turn, and a viewer sees it live', async ({
  page,
  otherPage,
  backend,
}) => {
  // A viewer on another browser, watching the log.
  const viewer = await otherPage()
  await open(viewer)
  await viewer.getByRole('tab', { name: 'Log' }).click()

  await open(page, red)
  await page.getByRole('tab', { name: 'Play' }).click()
  await expect(page.getByText(`Team ${red.name}`)).toBeVisible()
  const turn = page.getByRole('list', { name: 'Your turn' })
  await expect(turn.locator('[aria-current="step"]')).toHaveText(/^Tile/)

  // Dink would complete the tile; the admin fallback does the same.
  await backend.admin({ action: 'complete_tile', team: red.id })
  await expect(turn.locator('[aria-current="step"]')).toHaveText(/^Draw/)

  // The cards are fanned; the last one lies on top.
  await page
    .getByRole('button', { name: /^Face-down card/ })
    .last()
    .click()
  await page.getByRole('button', { name: 'Choose a path' }).click()
  await expect(turn.locator('[aria-current="step"]')).toHaveText(/^Walk/)

  const start = (await backend.team(red.id)).position
  await walkTheCard(page, start, await backend.tilesOf('red', 'shop'))
  await expect.poll(async () => (await backend.team(red.id)).position).not.toBe(start)

  // After the walk (and any shop on the way) the captain is on a new tile, with a new task.
  await finishWalk(page)

  // The viewer's log shows the draw, and the walk once the viewer's own page has animated it.
  await expect(viewer.getByText(new RegExp(`${red.name} drew`))).toBeVisible()
  await expect(viewer.getByText(new RegExp(`${red.name} set off \\d+ tiles`))).toBeVisible({
    timeout: 30_000,
  })
})
