import { test, expect } from '@playwright/test'

test('a first visit opens the tutorial, which can be skipped for good', async ({ page }) => {
  await page.goto('/stats')
  // It opens on the board, with the rest of the page hidden.
  await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeHidden()

  await page.getByRole('button', { name: 'Begin' }).click()
  const chat = page.getByRole('dialog', { name: 'Earl Grey says' })
  await expect(chat).toContainText('Welcome to Tweetea')

  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(chat).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'How to play' })).toBeHidden()

  // "How to play" opens it again.
  await page.getByRole('button', { name: 'How to play' }).click()
  await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible()
})
