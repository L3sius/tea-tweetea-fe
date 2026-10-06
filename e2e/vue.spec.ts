import { test, expect } from '@playwright/test'

test('shows the event title', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tweetea and the Magic Gems')
})
