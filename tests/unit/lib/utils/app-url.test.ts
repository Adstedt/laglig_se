/**
 * Tests for getAppUrl() — the URL fallback chain that prevents preview
 * deployments from silently emitting production URLs.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getAppUrl } from '@/lib/utils/app-url'

describe('getAppUrl', () => {
  const originalEnv = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    NODE_ENV: process.env.NODE_ENV,
  }

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.VERCEL_URL
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL
    process.env.VERCEL_URL = originalEnv.VERCEL_URL
    process.env.NODE_ENV = originalEnv.NODE_ENV
  })

  it('prefers NEXT_PUBLIC_APP_URL when set', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://staging.laglig.se'
    process.env.VERCEL_URL = 'should-not-win.vercel.app'
    expect(getAppUrl()).toBe('https://staging.laglig.se')
  })

  it('strips a trailing slash from NEXT_PUBLIC_APP_URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com/'
    expect(getAppUrl()).toBe('https://example.com')
  })

  it('falls back to https://VERCEL_URL when NEXT_PUBLIC_APP_URL is unset', () => {
    process.env.VERCEL_URL = 'laglig-se-git-feature-branch-team.vercel.app'
    expect(getAppUrl()).toBe(
      'https://laglig-se-git-feature-branch-team.vercel.app'
    )
  })

  it('falls back to localhost only outside production', () => {
    process.env.NODE_ENV = 'development'
    expect(getAppUrl()).toBe('http://localhost:3000')
  })

  it('throws in production when neither variable is set', () => {
    process.env.NODE_ENV = 'production'
    expect(() => getAppUrl()).toThrow(
      /NEXT_PUBLIC_APP_URL nor VERCEL_URL is set/
    )
  })

  it('treats an empty NEXT_PUBLIC_APP_URL as unset', () => {
    process.env.NEXT_PUBLIC_APP_URL = ''
    process.env.VERCEL_URL = 'preview.vercel.app'
    expect(getAppUrl()).toBe('https://preview.vercel.app')
  })
})
