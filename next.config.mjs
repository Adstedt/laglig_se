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
    // Router Cache Configuration (Story 2.19, Story 6.0)
    // This re-enables client-side caching that was disabled by default in Next.js 15
    // - dynamic: 300s (5 min) - Caches dynamic routes to reduce refetch frequency
    //   Allows back/forward navigation and filter exploration without refetching
    // - static: 600s (10 min) - Caches static routes for better performance
    //   Benefits document detail pages and static content
    // Story 6.0: Increased from 60s/180s to 300s/600s for better performance
    // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes
    staleTimes: {
      dynamic: 300, // Cache dynamic routes for 5 minutes (was 60s)
      static: 600, // Cache static routes for 10 minutes (was 180s)
    },
  },
  async headers() {
    return [
      // Security headers for all routes
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // Edge caching for catalogue pages - stale-while-revalidate for instant repeat visits
      {
        source: '/rattskallor',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=3600',
          },
        ],
      },
      {
        source: '/lagar',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=3600',
          },
        ],
      },
      {
        source: '/rattsfall',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=3600',
          },
        ],
      },
      {
        source: '/eu',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=3600',
          },
        ],
      },
      // Static pagination routes - longer cache (5 min edge, 1 hour stale)
      {
        source: '/rattskallor/sida/:page',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=3600',
          },
        ],
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
