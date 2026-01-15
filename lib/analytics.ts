/**
 * Safe Analytics Tracking
 *
 * Wraps @vercel/analytics/server track function with error handling
 * to prevent build failures when no request context is available
 * (e.g., during static page generation).
 */

import { track as vercelTrack } from '@vercel/analytics/server'
import { headers } from 'next/headers'

/**
 * Check if we're in a build/generation environment
 */
function isBuildTime(): boolean {
  return process.env.NODE_ENV === 'production' && !process.env.VERCEL
}

/**
 * Safely track an analytics event.
 * Silently ignores errors when no session context is available
 * (common during static page generation / build time).
 *
 * @param event - Event name
 * @param properties - Event properties
 * @param request - Optional request or headers for context
 */
export async function safeTrack(
  event: string,
  properties?: Record<string, string | number | boolean | null>,
  request?: Request | Headers
): Promise<void> {
  // Skip tracking during build time
  if (isBuildTime()) {
    return
  }

  try {
    // Try to get headers if not provided
    const trackHeaders = request || (await headers().catch(() => null))

    // Only track if we have valid context
    if (trackHeaders) {
      // Properly format the options based on the type of headers
      const options =
        trackHeaders instanceof Headers
          ? { headers: trackHeaders }
          : { request: trackHeaders as Request }

      await vercelTrack(event, properties, options)
    }
  } catch (error) {
    // Silently ignore "No session context found" errors during build
    // These occur during static page generation when there's no request
    if (
      error instanceof Error &&
      error.message.includes('No session context found')
    ) {
      return
    }
    // Only log in development, not during builds
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Analytics] Failed to track "${event}":`, error)
    }
  }
}

/**
 * Track an event without awaiting (fire-and-forget).
 * Use this when you don't want to block the response.
 */
export function trackAsync(
  event: string,
  properties?: Record<string, string | number | boolean | null>,
  request?: Request | Headers
): void {
  safeTrack(event, properties, request).catch(() => {
    // Already handled in safeTrack
  })
}
