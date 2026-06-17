import { defineConfig, devices } from '@playwright/test'
import { config as dotenvConfig } from 'dotenv'

dotenvConfig({ path: '.env.local', override: false })

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: 'html',

  // Fail fast: when the preview is unreachable (e.g. Vercel protection blocks
  // the runner) don't grind through every test × retries for hours.
  ...(process.env.CI ? { maxFailures: 10 } : {}),

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Bypass Vercel Deployment Protection on preview deployments so the runner
    // reaches the app instead of Vercel's SSO challenge page.
    // https://vercel.com/docs/security/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
    ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          extraHTTPHeaders: {
            'x-vercel-protection-bypass':
              process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
            'x-vercel-set-bypass-cookie': 'true',
          },
        }
      : {}),
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/auth\.setup\.ts/, /epic-21\//],
    },
    {
      name: 'chromium-authed',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/user.json',
      },
      testMatch: /epic-21\/.*\.spec\.ts/,
      dependencies: ['setup'],
    },
  ],

  ...(process.env.CI
    ? {}
    : {
        webServer: {
          command: 'pnpm dev',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
})
