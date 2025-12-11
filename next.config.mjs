import { withSentryConfig } from '@sentry/nextjs'

/**
 * Security headers configuration
 * See lib/security/headers.ts for TypeScript types and documentation
 */
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "font-src 'self'",
  "connect-src 'self' https://api.openai.com https://*.supabase.co https://*.sentry.io https://vercel.live wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: cspDirectives.join('; '),
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    // Router Cache Configuration (Story 2.19)
    // This re-enables client-side caching that was disabled by default in Next.js 15
    // - dynamic: 60s - Caches dynamic routes (with searchParams) for 60 seconds
    //   Allows back/forward navigation and filter exploration without refetching
    // - static: 180s - Caches static routes for 3 minutes
    //   Benefits document detail pages and static content
    // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes
    staleTimes: {
      dynamic: 60, // Cache dynamic routes for 60 seconds (catalogue with filters)
      static: 180, // Cache static routes for 3 minutes (document detail pages)
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps in CI
  silent: !process.env.CI,

  // Automatically hide source maps from users
  hideSourceMaps: true,

  // Disable widening sourcemap file path
  disableLogger: true,

  // Auto instrument server components
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,
  autoInstrumentAppDirectory: true,
})
