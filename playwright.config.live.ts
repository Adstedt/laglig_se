import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'https://laglig-se.vercel.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        browserName: 'chromium',
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
  // NO webServer - using live site
})