import { withSentryConfig } from '@sentry/nextjs'
import bundleAnalyzer from '@next/bundle-analyzer'
import createMDX from '@next/mdx'

// Story 26.1: MDX content surface for marketing pages. Content lives in
// content/marketing/**/*.mdx and is loaded via dynamic import in the
// app/(marketing) routes — pageExtensions is deliberately NOT extended, so
// .mdx files can never become routable pages on their own.
// Plugins are passed as strings (Turbopack requirement: no JS functions
// cross the Rust boundary). remark-frontmatter keeps the YAML block out of
// the rendered output; parsing/validation happens in lib/marketing/content.ts.
const withMDX = createMDX({
  options: {
    remarkPlugins: ['remark-frontmatter'],
  },
})

// Story P.4: Bundle analyzer configuration
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

/**
 * Security headers configuration
 * See lib/security/headers.ts for TypeScript types and documentation
 */
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://*.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "font-src 'self'",
  "connect-src 'self' https://api.openai.com https://*.supabase.co https://*.sentry.io https://vercel.live wss://*.supabase.co https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
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

// Headless-Chromium PDF routes (puppeteer-core + @sparticuz/chromium). These
// packages are externalized (loaded from node_modules at runtime, not bundled),
// but the Turbopack/nft tracer follows puppeteer-core's CJS entry and misses
// @puppeteer/browsers' ESM files that the ESM import chain actually loads on
// Vercel — ERR_MODULE_NOT_FOUND for
// @puppeteer/browsers/lib/esm/browser-data/browser-data.js. Force-include the
// full package trees for just the PDF-rendering routes. Both the hoisted
// top-level path AND the pnpm `.pnpm` real path are globbed because transitive
// deps (@puppeteer/browsers) may not be hoisted to top-level node_modules on
// the Vercel build; redundant globs are harmless.
const PDF_RUNTIME_INCLUDES = [
  './node_modules/puppeteer-core/**/*',
  './node_modules/@puppeteer/browsers/**/*',
  './node_modules/@sparticuz/chromium/**/*',
  './node_modules/.pnpm/puppeteer-core@*/node_modules/**/*',
  './node_modules/.pnpm/@puppeteer+browsers@*/node_modules/**/*',
  './node_modules/.pnpm/@sparticuz+chromium@*/node_modules/**/*',
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Story 26.4: hide the dev-mode indicator badge so it never overlaps
  // marketing-screenshot captures (it floats bottom-left in dev; never ships
  // to production regardless).
  devIndicators: false,
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
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error', 'warn'],
          }
        : false,
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

  // Story 14.9: Include system prompt .md file in serverless function bundles
  outputFileTracingIncludes: {
    '/api/chat': ['./lib/agent/system-prompt.md'],
    // Story 26.1: OG generator reads the Safiro .woff + marketing MDX
    // frontmatter from the function filesystem. Keys are declared in BOTH
    // shapes — URL path AND route-group filesystem path — because the
    // tracer's key convention for route-group routes is ambiguous across
    // Next/Vercel versions (QA-26.1-1). Redundant keys are harmless;
    // verify GET /og-image/<kind>/<slug> returns image/png on the first
    // preview deploy.
    '/og-image/[kind]/[slug]': [
      './public/fonts/safiro-medium-webfont.woff',
      './content/marketing/**/*.mdx',
    ],
    '/(marketing)/og-image/[kind]/[slug]': [
      './public/fonts/safiro-medium-webfont.woff',
      './content/marketing/**/*.mdx',
    ],
    // Marketing routes read content/marketing at render/build time.
    '/funktioner/[slug]': ['./content/marketing/**/*.mdx'],
    '/branscher/[slug]': ['./content/marketing/**/*.mdx'],
    '/omraden/[slug]': ['./content/marketing/**/*.mdx'],
    '/(marketing)/funktioner/[slug]': ['./content/marketing/**/*.mdx'],
    '/(marketing)/branscher/[slug]': ['./content/marketing/**/*.mdx'],
    '/(marketing)/omraden/[slug]': ['./content/marketing/**/*.mdx'],
    // PDF export + revisionsrapport routes need the full Chromium/puppeteer
    // package trees traced into their serverless functions (see
    // PDF_RUNTIME_INCLUDES above). Route-group keys declared in both shapes
    // because the tracer's convention for (group) routes is version-ambiguous.
    '/api/workspace/documents/[documentId]/export': PDF_RUNTIME_INCLUDES,
    '/laglistor/kontroller/[cycleId]/rapport/pdf': PDF_RUNTIME_INCLUDES,
    '/(workspace)/laglistor/kontroller/[cycleId]/rapport/pdf':
      PDF_RUNTIME_INCLUDES,
  },

  // Serverless function size cap (250 MB unzipped). The Next.js file tracer
  // was sweeping `data/`, `docs/`, `tests/`, `_prototype/`, and `scripts/` into
  // every serverless function via some path-string reference, pushing
  // /api/chat and /api/workspace/generate-law-list to ~428 MB each (per the
  // VERCEL_ANALYZE_BUILD_OUTPUT report). None of these directories are read
  // at runtime by app/ or lib/ code:
  //   - data/{msbfs-pdfs,notisum-amnesfokus,sfs-indexes}: ingestion-time only
  //     (loaded into Postgres + pgvector by scripts/crons; runtime queries
  //     hit the DB). Verified by grep across app/ + lib/.
  //   - docs/: PRD, stories, plans, QA gates — never shipped to production.
  //   - tests/: unit + e2e tests + their committed screenshots.
  //   - _prototype/: HTML mockups.
  //   - scripts/: one-off TS scripts run via `pnpm tsx scripts/...`.
  outputFileTracingExcludes: {
    // Global excludes — non-production directories that should never ship.
    '*': ['data/**', 'docs/**', 'tests/**', '_prototype/**', 'scripts/**'],
    // The two routes Vercel flagged + the cron family don't render PDFs;
    // Chromium (~64 MB) + puppeteer-core (~12 MB) are only legitimately
    // needed by /api/workspace/documents/*/export (the PDF export route)
    // and the styrdokument PDF report page. NOT excluding `openai/**` from
    // /api/chat: the retrieval pipeline (lib/agent/retrieval.ts →
    // lib/chunks/embed-chunks.ts) uses it at runtime for query embeddings.
    '/api/chat/**': [
      'node_modules/@sparticuz/chromium/**',
      'node_modules/puppeteer-core/**',
    ],
    '/api/workspace/generate-law-list/**': [
      'node_modules/@sparticuz/chromium/**',
      'node_modules/puppeteer-core/**',
    ],
    '/api/cron/**': [
      'node_modules/@sparticuz/chromium/**',
      'node_modules/puppeteer-core/**',
    ],
  },

  experimental: {
    // Story 6.7a: Increase Server Actions body size limit for file uploads (25MB)
    // Next.js 16: must live under `experimental.serverActions` (root-level was silently ignored)
    serverActions: {
      bodySizeLimit: '25mb',
    },
    // Story 17.8: /filer uploads pass through proxy.ts, whose request-body buffer
    // defaults to 10MB — PDFs >10MB were truncated ("Unexpected end of form")
    // before uploadFile ran. Raise it to match the 25MB upload cap + the
    // serverActions limit above. (Formerly middlewareClientMaxBodySize, renamed
    // in Next 16 — the two cannot coexist.)
    proxyClientMaxBodySize: '25mb',
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
  async redirects() {
    return [
      // Workspace documents renamed to styrdokument
      {
        source: '/workspace/documents',
        destination: '/workspace/styrdokument',
        permanent: true,
      },
      {
        source: '/workspace/documents/:path*',
        destination: '/workspace/styrdokument/:path*',
        permanent: true,
      },
      // File browser renamed from /documents to /filer
      {
        source: '/documents',
        destination: '/filer',
        permanent: true,
      },
      {
        source: '/documents/:path*',
        destination: '/filer/:path*',
        permanent: true,
      },
    ]
  },
}

// Story P.4: Wrap with bundle analyzer, then Sentry (MDX innermost — Story 26.1)
export default withSentryConfig(withBundleAnalyzer(withMDX(nextConfig)), {
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
