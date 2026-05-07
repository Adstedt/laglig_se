import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { config as loadEnv } from 'dotenv'

// Load .env.local before vitest runs
// This ensures DATABASE_URL is available when Prisma client initializes
loadEnv({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/e2e/**', // Exclude Playwright E2E tests
    ],
    // Story 24.4 QA gate TEST-002: integration tests share the staging
    // database through prisma — running multiple integration files in
    // parallel workers causes occasional Supabase-pool contention where a
    // server action's prisma call times out and returns
    // `{success: false}`, producing a spurious test failure. Force the
    // integration suite to run in a single fork so all integration tests
    // serialise on one prisma client. Unit tests keep the default thread
    // pool — only the matched integration files take the slow path.
    poolMatchGlobs: [
      [
        '**/tests/integration/**',
        'forks',
      ],
    ],
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: [
      // More specific aliases must come first
      { find: '@/hooks', replacement: path.resolve(__dirname, './lib/hooks') },
      { find: '@', replacement: path.resolve(__dirname, './') },
    ],
  },
})
