-- Story 5.5a: Trial workspaces remember which tier was picked at signup
--
-- Adds a nullable column on `workspaces` so getEffectiveLimits() can apply the
-- right caps during the trial window. NULL on existing rows is fine — they fall
-- back to TIER_LIMITS[subscription_tier] (TRIAL → Solo equivalent) until a real
-- value is set by the Epic 4 signup tier-picker.
--
-- Cleared on trial→paid conversion: when subscription_tier flips from 'TRIAL'
-- to 'SOLO'/'TEAM', the conversion server action sets this back to NULL.
--
-- Migration is non-blocking: nullable column add, no backfill, no drift risk.

ALTER TABLE "workspaces"
  ADD COLUMN "trial_picked_tier" "SubscriptionTier";
