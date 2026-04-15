/**
 * Resolve the canonical app URL for the current runtime, with a deliberate
 * fallback chain that does NOT silently leak production URLs from preview
 * deployments.
 *
 * Order:
 *   1. NEXT_PUBLIC_APP_URL — set explicitly per-env (production custom domain,
 *      staging, etc). Wins when present.
 *   2. VERCEL_URL — auto-populated by Vercel for every deployment including
 *      previews, e.g. "laglig-se-git-feature-x-team.vercel.app". Lacks the
 *      protocol so we prepend https://.
 *   3. http://localhost:3000 — local dev fallback only. Asserts in production
 *      so we never ship an outbound email with a localhost link.
 *
 * Originally introduced for Story 5.3 invitation emails (QA gate SEC-001):
 * the previous fallback to `'https://laglig.se'` caused preview environments
 * to ship invitation emails pointing at production, which 404'd against
 * tokens that only existed in the preview database.
 */
export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit && explicit.length > 0) return stripTrailingSlash(explicit)

  const vercel = process.env.VERCEL_URL
  if (vercel && vercel.length > 0) {
    return `https://${stripTrailingSlash(vercel)}`
  }

  if (process.env.NODE_ENV === 'production') {
    // Hard fail in prod rather than emit an unusable localhost link in an
    // outbound email or webhook payload.
    throw new Error(
      'getAppUrl: neither NEXT_PUBLIC_APP_URL nor VERCEL_URL is set in production'
    )
  }

  return 'http://localhost:3000'
}

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s
}
