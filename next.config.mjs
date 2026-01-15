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
  productionBrowserSourceMaps: false, // Disable source maps in production for security
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // Story P.2: Image Optimization Configuration (AC: 19-21)
  images: {
    // Enable modern image formats
    formats: ['image/avif', 'image/webp'],
    // Define external image patterns using remotePatterns (replaces deprecated domains)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Image sizes for different layouts
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Minimize images in production
    minimumCacheTTL: 60,
    // Disable static imports for runtime optimization
    disableStaticImages: false,
  },
  
  // Story P.2: Compiler optimizations (AC: 23)
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Story P.2: Bundle size optimizations
  webpack: (config, { isServer }) => {
    // Optimize bundle splitting
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor code splitting
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20,
          },
          // Common modules
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
        },
      }
    }
    return config
  },
  
  experimental: {
    // Story P.2: Enable optimizeCss for smaller CSS bundles
    optimizeCss: true,
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
