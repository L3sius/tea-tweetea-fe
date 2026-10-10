import { test, expect } from '@playwright/test'

test('draws characters from the exported OSRS assets', async ({ page }) => {
  // A first visit opens the tutorial over the page (see tutorial.spec.ts).
  await page.addInitScript(() => localStorage.setItem('tweetea.tutorial', '1'))
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/characters')
  const canvases = page.locator('canvas.character-preview')
  await expect(canvases.first()).toBeVisible()

  // Every canvas ends up with some opaque pixels once its model and animation have loaded.
  await expect
    .poll(
      () =>
        canvases.evaluateAll((all) =>
          all.map((canvas) => {
            const c = canvas as HTMLCanvasElement
            const pixels = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data ?? []
            let drawn = 0
            for (let i = 3; i < pixels.length; i += 4) if ((pixels[i] ?? 0) > 0) drawn++
            return drawn
          }),
        ),
      { timeout: 15_000 },
    )
    .not.toContain(0)

  // Searching finds NPCs beyond the featured few.
  await page.getByLabel('Search NPCs').fill('drunken')
  await expect(page.getByRole('button', { name: /Drunken man/ }).first()).toBeVisible()
  expect(errors).toEqual([])
})
