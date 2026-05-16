-- Story 25.0 (Epic 25): First-run onboarding modal — schema foundations.
--
-- Mostly additive. One deliberate exception: this migration DROPs the DEFAULT
-- on an existing column (workspaces.law_list_generation_status). That drop is
-- REQUIRED — with the wizard auto-fire removed (Story 25.0 AC 14), new
-- workspaces must land at NULL so getOnboardingState's null-check opens the
-- first-run modal. A DROP DEFAULT only affects future INSERTs; every existing
-- row keeps whatever value it already has. Zero DROP COLUMN, zero RENAME,
-- zero data loss.
--
-- RLS: follows the project pattern (see 20260430120000_enable_rls_public_tables
-- and the per-table ENABLE in 20260507120000_add_law_list_import) — the new
-- onboarding_events table gets ROW LEVEL SECURITY enabled with NO policy
-- (default deny for non-bypass roles; Prisma's postgres role bypasses, so
-- server-side queries via prisma.* are unaffected). No CREATE POLICY blocks.

-- AlterTable: add three nullable first-run columns to workspaces
ALTER TABLE "workspaces" ADD COLUMN     "first_run_dismissed_at" TIMESTAMP(3),
ADD COLUMN     "tutorial_fab_dismissed_at" TIMESTAMP(3),
ADD COLUMN     "first_run_tabs_viewed" JSONB DEFAULT '[]';

-- AlterTable: drop the @default('pending') on law_list_generation_status
-- (Story 25.0 AC 2 — new workspaces must land at NULL for the modal trigger)
ALTER TABLE "workspaces" ALTER COLUMN "law_list_generation_status" DROP DEFAULT;

-- CreateTable
CREATE TABLE "onboarding_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "onboarding_events_workspace_id_created_at_idx" ON "onboarding_events"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "onboarding_events_event_type_idx" ON "onboarding_events"("event_type");

-- AddForeignKey
ALTER TABLE "onboarding_events" ADD CONSTRAINT "onboarding_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_events" ADD CONSTRAINT "onboarding_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS on the new table (project pattern: ENABLE, no policy).
ALTER TABLE "public"."onboarding_events" ENABLE ROW LEVEL SECURITY;
