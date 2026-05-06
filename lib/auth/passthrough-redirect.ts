/**
 * Story 5.13: helper for server actions whose try/catch would otherwise
 * swallow Next.js's `NEXT_REDIRECT` exception.
 *
 * Many server actions wrap their logic in a generic `try { ... } catch (err)
 * { console.error; return { success: false } }` pattern. When the workspace
 * is gated by TRIAL_EXPIRED or PAYMENT_PAST_DUE, our `assertTrialNotExpired`
 * (in workspace-context) calls Next.js `redirect()` which throws a special
 * `NEXT_REDIRECT` exception. The framework intercepts this exception and
 * emits a 307 — but ONLY if the exception propagates back to it.
 *
 * Generic catch blocks swallow it, which (a) breaks the redirect and (b)
 * floods the dev console with NEXT_REDIRECT errors logged via console.error.
 *
 * Call this at the top of any server action's catch block. It re-throws if
 * the error is the framework's redirect signal; otherwise it returns and
 * lets the caller handle the error normally.
 *
 * Usage:
 *   try {
 *     return await withWorkspace(...)
 *   } catch (error) {
 *     passthroughRedirect(error)
 *     console.error('myAction failed:', error)
 *     return { success: false, error: '...' }
 *   }
 */
import { isRedirectError } from 'next/dist/client/components/redirect-error'

export function passthroughRedirect(error: unknown): void {
  if (isRedirectError(error)) {
    throw error
  }
}
