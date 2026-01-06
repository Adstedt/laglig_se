import '@testing-library/jest-dom'
import { config } from 'dotenv'
import path from 'path'

// Load .env.local explicitly for integration tests
config({ path: path.resolve(process.cwd(), '.env.local') })

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
