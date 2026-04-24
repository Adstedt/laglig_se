-- Drift repair: add the 'pending' default that already exists in production to workspaces.law_list_generation_status.
--
-- Background: the column was added by migration 20260330000000_add_law_list_generation_status with no DEFAULT.
-- At some point a `DEFAULT 'pending'` was set directly in Supabase but never captured in a migration file.
-- This migration brings filesystem + schema.prisma + live DB into alignment so fresh environments match prod.
--
-- Production safety: this is idempotent on prod (already has DEFAULT 'pending'). Mark applied via
-- `prisma migrate resolve --applied` rather than running — the SET DEFAULT would be a no-op but the resolve
-- keeps tracking table consistent with the manual-Supabase workflow.

ALTER TABLE "workspaces"
  ALTER COLUMN "law_list_generation_status" SET DEFAULT 'pending';
