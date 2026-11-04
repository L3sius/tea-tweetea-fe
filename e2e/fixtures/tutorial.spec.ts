import { test, expect } from '@playwright/test'

test('a first visit opens the tutorial, then the Dink setup, each once', async ({ page }) => {
  await page.goto('/stats')
  // It opens on the board, with the rest of the page hidden.
  await expect(page.getByRole('heading', { name: 'Tutorial' })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeHidden()

  await page.getByRole('button', { name: 'Begin' }).click()
  const chat = page.getByRole('dialog', { name: 'Earl Grey says' })
  await expect(chat).toContainText('Tweetea and the Magic Gems')

  // Exactly "Skip": the title's "Skip the tour" may still be fading out.
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await expect(chat).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // Skipped or finished, the tour hands over to the Dink setup, which only its button closes.
  const dink = page.getByRole('dialog', { name: 'Set up Dink' })
  await expect(dink).toContainText('/dink/config')
  await page.keyboard.press('Escape')
  await expect(dink).toBeVisible()
  await dink.getByRole('button', { name: "I've set it up" }).click()
  await expect(dink).toBeHidden()

  await page.reload()
  await expect(dink).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tutorial' })).toBeHidden()
  // With no tour running, the whole board is drawn: roads and nodes, gems and shops.
  await expect(page.locator('.leaflet-overlay-pane canvas')).toHaveCount(1)
  await expect(page.locator('.gem-marker').first()).toBeVisible()

  // "Tutorial" opens it again.
  await page.getByRole('button', { name: 'Tutorial' }).click()
  await expect(page.getByRole('heading', { name: 'Tutorial' })).toBeVisible()
})
