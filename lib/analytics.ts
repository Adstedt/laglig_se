/**
 * Safe Analytics Tracking
 *
 * Wraps @vercel/analytics/server track function with error handling
 * to prevent build failures when no request context is available
 * (e.g., during static page generation).
 */

import { track as vercelTrack } from '@vercel/analytics/server'

/**
 * Safely track an analytics event.
 * Silently ignores errors when no session context is available
 * (common during static page generation / build time).
 *
 * @param event - Event name
 * @param properties - Event properties
 */
export async function safeTrack(
  event: string,
  properties?: Record<string, string | number | boolean | null>
): Promise<void> {
  try {
    await vercelTrack(event, properties)
  } catch (error) {
    // Silently ignore "No session context found" errors during build
    // These occur during static page generation when there's no request
    if (
      error instanceof Error &&
      error.message.includes('No session context found')
    ) {
      return
    }
    // Log other unexpected errors but don't throw
    console.warn(`[Analytics] Failed to track "${event}":`, error)
  }
}

/**
 * Track an event without awaiting (fire-and-forget).
 * Use this when you don't want to block the response.
 */
export function trackAsync(
  event: string,
  properties?: Record<string, string | number | boolean | null>
): void {
  safeTrack(event, properties).catch(() => {
    // Already handled in safeTrack
  })
}
