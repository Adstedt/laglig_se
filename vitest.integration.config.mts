import { defineConfig } from 'vitest/config'
import path from 'path'
import { config as loadEnv } from 'dotenv'

// Load .env.local before vitest runs
loadEnv({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  test: {
    environment: 'node', // Use node environment for integration tests
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/tests/integration/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
  },
  resolve: {
    alias: [
      { find: '@/hooks', replacement: path.resolve(__dirname, './lib/hooks') },
      { find: '@', replacement: path.resolve(__dirname, './') },
    ],
  },
})
