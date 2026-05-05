-- Story 5.12: Tier-picker step in onboarding wizard.
-- Adds enterprise_inquiry_at to Workspace. When set during workspace creation,
-- signals user picked Enterprise during onboarding. Trial limits remain capped
-- at Team via trial_picked_tier='TEAM' to bound COGS during the wait-for-sales
-- window. Sales rep clears this column when Enterprise contract is signed.
--
-- Apply via Supabase SQL Editor (user-applied-migration workflow established
-- in Story 21.1; same pattern as Stories 5.4, 5.5a). After applying, register
-- with: npx prisma migrate resolve --applied 20260505192709_add_enterprise_inquiry_at

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN "enterprise_inquiry_at" TIMESTAMP(3);
