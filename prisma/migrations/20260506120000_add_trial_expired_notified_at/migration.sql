-- Story 5.13: Trial Expiration Hard Gate + Stripe Checkout Conversion
-- Adds idempotency lock for the daily expire-trials cron so the trial-ended
-- email is sent at most once per workspace, even if the cron retries or
-- runs twice on the same day.

ALTER TABLE "workspaces" ADD COLUMN "trial_expired_notified_at" TIMESTAMP(3);
