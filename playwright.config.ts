import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

/**
 * Two kinds of end-to-end test, each against its own dev server:
 * - `fixtures` (e2e/fixtures): the site on recorded API responses, no backend needed.
 * - `live` (e2e/live): the site on a real tweety, started on an empty game by
 *   scripts/e2e-backend.mjs. Each test resets it and seeds its own teams. Tests that need the
 *   play-testing admin actions skip when tweety has none.
 *
 * The ports are not the usual 5173 and 8080, so a play-testing setup can keep running.
 * See docs/e2e.md.
 */
const FIXTURES_PORT = 5174
const LIVE_PORT = 5175

/** Playwright's bundled browsers are out of date on Windows here; Edge is always installed. */
const chromium = process.platform === 'win32' ? { channel: 'msedge' } : {}

export default defineConfig({
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Live tests share one backend, so they can't run side by side.
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    actionTimeout: 0,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // VIDEO=1 records every page, to watch in the HTML report (npx playwright show-report).
    video: process.env.VIDEO ? 'on' : 'off',
    headless: !process.env.HEADED,
  },

  projects: [
    {
      name: 'fixtures',
      testDir: './e2e/fixtures',
      use: {
        ...devices['Desktop Chrome'],
        ...chromium,
        baseURL: `http://localhost:${FIXTURES_PORT}`,
      },
    },
    {
      name: 'live',
      testDir: './e2e/live',
      // A whole turn waits on card flips and walk animations.
      timeout: 120 * 1000,
      expect: { timeout: 10_000 },
      use: { ...devices['Desktop Chrome'], ...chromium, baseURL: `http://localhost:${LIVE_PORT}` },
    },
  ],

  webServer: [
    {
      command: `npx vite --port ${FIXTURES_PORT} --strictPort`,
      port: FIXTURES_PORT,
      env: { VITE_API_MODE: 'fixtures' },
      reuseExistingServer: true,
    },
    {
      command: `npx vite --port ${LIVE_PORT} --strictPort`,
      port: LIVE_PORT,
      env: { VITE_API_MODE: 'http', VITE_API_BASE_URL: 'http://127.0.0.1:8090' },
      reuseExistingServer: true,
    },
    {
      command: 'node scripts/e2e-backend.mjs',
      url: 'http://127.0.0.1:8091/health',
      // The first run may build tweety.
      timeout: 10 * 60 * 1000,
      reuseExistingServer: true,
    },
  ],
})
