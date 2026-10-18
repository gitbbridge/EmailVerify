import { defineConfig } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT || 5193)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  use: { baseURL, headless: true, channel: 'msedge' },
  webServer: { command: `npm run dev:web -- --port ${port} --strictPort`, url: baseURL, reuseExistingServer: false },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 960 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
})
