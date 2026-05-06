/**
 * Story 5.13: Trial duration + grace-window constants.
 *
 * Single source of truth for trial lifecycle timing. All createWorkspace,
 * cron handlers, UI copy, and emails MUST import from here rather than
 * hardcoding day counts.
 *
 * Lifecycle (counted from signup):
 *   Day 0      → Workspace created, trial starts
 *   Day 15     → trial_ends_at; cron fires at next 00:30 UTC, gate activates
 *   Day 45     → cron flips status=PAUSED + sends paused-warning email
 *   Day 75     → cron flips status=DELETED (no email — user already warned)
 *   Day 105    → existing cleanup-workspaces cron hard-deletes (Story 5.1)
 */

export const TRIAL_DURATION_DAYS = 15

/**
 * Days after trial_ends_at before workspace status flips to PAUSED.
 * The user remains gated to the conversion page during this window but
 * data is fully recoverable via Stripe Checkout.
 */
export const TRIAL_GRACE_PAUSE_DAYS = 30

/**
 * Days after trial_ends_at before workspace status flips to DELETED.
 * After this, the existing cleanup-workspaces cron hard-deletes 30 days later.
 */
export const TRIAL_GRACE_DELETE_DAYS = 60
