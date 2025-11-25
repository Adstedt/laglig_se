/**
 * Security headers configuration for Laglig.se
 *
 * NOTE: The actual headers are defined in next.config.mjs because
 * Node.js cannot directly import TypeScript files during config loading.
 *
 * This file provides TypeScript types and documentation.
 * If headers need to be updated, update BOTH this file and next.config.mjs.
 *
 * Applied via next.config.mjs headers() to all routes.
 */

export interface SecurityHeader {
  key: string
  value: string
}

/**
 * Content Security Policy directives
 *
 * - 'self': Same origin only
 * - 'unsafe-inline': Required for Tailwind CSS / shadcn/ui styles
 * - 'unsafe-eval': Required for Next.js development tools
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

/**
 * Security headers array for Next.js config
 *
 * Includes:
 * - Content-Security-Policy (CSP)
 * - X-Frame-Options (clickjacking protection)
 * - X-Content-Type-Options (MIME sniffing protection)
 * - Referrer-Policy (referrer information control)
 * - Strict-Transport-Security (HSTS)
 * - Permissions-Policy (disable unused browser features)
 */
export const securityHeaders: SecurityHeader[] = [
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
