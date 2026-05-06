import { config } from 'dotenv'
import path from 'path'

// Pin the TZ so date-fns output (revisionsrapport renderer, finding timestamps,
// cycle-detail formatters) is stable across local Stockholm devs and UTC CI.
// Must be set before any module that touches Intl / Date formatting initialises.
process.env.TZ = 'Europe/Stockholm'

// Load .env.local FIRST before any other imports
// This ensures env vars are available when modules initialize
const envResult = config({ path: path.resolve(process.cwd(), '.env.local') })

// Log Redis config status for debugging
if (process.env.CI !== 'true') {
  console.log('Test Setup - Redis Config:', {
    url: process.env.UPSTASH_REDIS_REST_URL ? '✓ Set' : '✗ Missing',
    token: process.env.UPSTASH_REDIS_REST_TOKEN ? '✓ Set' : '✗ Missing',
    envLoaded: envResult.error ? '✗ Failed' : '✓ Success',
  })
}

// Force Redis reinitialization after env vars are loaded
import { reinitializeRedis } from '../lib/cache/redis'
reinitializeRedis()

// Now import other modules
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Global mock for @/lib/stripe/config — happy-dom (used by component tests)
// defines `window`, which trips t3-env-nextjs's client-context check when
// any source file transitively imports lib/stripe/config (which reads
// `env.STRIPE_SECRET_KEY` at module load). Component tests that render
// settings/billing/onboarding surfaces pull this in via the import chain
// and would otherwise crash before the test body runs.
//
// Tests that legitimately exercise Stripe (tests/unit/billing/*,
// tests/unit/webhooks/stripe-*) define their own per-file vi.mock for
// '@/lib/stripe/config' which overrides this global stub.
vi.mock('@/lib/stripe/config', () => ({
  stripe: {
    customers: { create: vi.fn(), retrieve: vi.fn(), update: vi.fn() },
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), cancel: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    invoices: { list: vi.fn() },
    webhooks: { constructEvent: vi.fn() },
    billingPortal: { sessions: { create: vi.fn() } },
  },
  STRIPE_PRICE_IDS: {
    SOLO: 'price_solo_test',
    TEAM: 'price_team_test',
    ENTERPRISE: 'price_enterprise_test',
  },
  tierForPriceId: vi.fn(() => undefined),
}))

// Mock pointer capture methods for Radix UI components (Select, Popover, etc.)
// These are not implemented in happy-dom/jsdom
if (typeof Element !== 'undefined') {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}

// Mock scrollIntoView for Radix components
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// Mock environment variables ONLY if none are loaded (for unit tests)
// Integration tests will use real env vars from .env.local
if (
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes('localhost:5432')
) {
  // Throw error for integration tests - they must have real DB connection
  if (process.env.VITEST_POOL_ID !== undefined) {
    console.warn('⚠️  WARNING: DATABASE_URL not loaded from .env.local')
    console.warn('   Integration tests require Supabase database connection')
    console.warn('   Check that .env.local exists and contains DATABASE_URL')
  }
}
// NODE_ENV is read-only in Vitest, set via config instead
