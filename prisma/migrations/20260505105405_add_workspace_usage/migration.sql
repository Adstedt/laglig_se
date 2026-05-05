-- Story 5.5c: WorkspaceUsage — denormalised counter for AI-token quota
--
-- One row per workspace. Updated in the same prisma.$transaction as
-- ChatUsageEvent on every chat turn so the per-turn audit log + the
-- running total cannot drift. Reset by the customer.subscription.updated
-- Stripe webhook when current_period_end advances (Pattern A —
-- per-customer billing-cycle-anchored). Defensive weekly safety cron
-- catches missed webhooks.
--
-- BigInt for tokens: at 18M/month for Team and potential heavy outliers,
-- regular Int (max ~2.1B) is plenty headroom but BigInt is the safer
-- choice once 5.5d's metered overage relaxes the 2× hard cap.
--
-- Notes for the operator:
--   * No data backfill required — rows are created on first chat turn
--     via prisma.workspaceUsage.upsert in app/api/chat/route.ts onFinish.
--   * Existing workspaces start with no row; first chat creates with
--     period_started_at = workspace.created_at (anchors trial period
--     to workspace creation, not first chat).

-- CreateTable
CREATE TABLE "workspace_usage" (
    "id"                      TEXT      NOT NULL,
    "workspace_id"            TEXT      NOT NULL,
    "tokens_used_this_period" BIGINT    NOT NULL DEFAULT 0,
    "storage_bytes"           BIGINT    NOT NULL DEFAULT 0,
    "period_started_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_usage_workspace_id_key"
  ON "workspace_usage"("workspace_id");

-- AddForeignKey
ALTER TABLE "workspace_usage"
  ADD CONSTRAINT "workspace_usage_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
