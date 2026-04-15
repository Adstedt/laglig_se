/**
 * Shared constants for the workspace invitation flow (Story 5.3).
 */

/**
 * How long a pending invitation remains valid after creation.
 * Reused by POST (create) and resend endpoints so the TTL only lives in
 * one place. Aligned with the 7-day copy in the React Email template and
 * the daily cleanup cron.
 */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
