import { test, expect } from '@playwright/test'

test('shows the event title', async ({ page }) => {
  // A first visit opens the tutorial over the page (see tutorial.spec.ts).
  await page.addInitScript(() => localStorage.setItem('tweetea.tutorial', '1'))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tweetea and the Magic Gems')
})
