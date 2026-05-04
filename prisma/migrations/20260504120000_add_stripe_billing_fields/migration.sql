-- Story 5.4: Stripe subscription billing
--
-- Extends the workspaces table with 5 inline Stripe-related columns and adds a
-- StripeWebhookEvent table for webhook idempotency. Snake_case per coding-
-- standards 17.4. Schema decision: inline-on-Workspace (Story 5.1 precedent),
-- not the separate Subscription model documented in architecture §9.11.
--
-- Notes for the operator:
--   * No data backfill required — all new workspace columns are nullable.
--   * The unique index on workspaces.stripe_customer_id allows multiple NULLs
--     in PostgreSQL (default behavior), so existing rows are unaffected.
--   * The stray `DROP INDEX content_chunks_embedding_idx` produced by
--     `prisma migrate diff` is unrelated drift and intentionally omitted.

-- AlterTable
ALTER TABLE "workspaces"
  ADD COLUMN "stripe_customer_id"           TEXT,
  ADD COLUMN "stripe_subscription_id"       TEXT,
  ADD COLUMN "subscription_status"          TEXT,
  ADD COLUMN "current_period_end"           TIMESTAMP(3),
  ADD COLUMN "payment_grace_period_ends_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "stripe_webhook_events" (
    "id"              TEXT      NOT NULL,
    "stripe_event_id" TEXT      NOT NULL,
    "event_type"      TEXT      NOT NULL,
    "processed_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stripe_webhook_events_stripe_event_id_key"
  ON "stripe_webhook_events"("stripe_event_id");

-- CreateIndex
CREATE INDEX "stripe_webhook_events_processed_at_idx"
  ON "stripe_webhook_events"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_stripe_customer_id_key"
  ON "workspaces"("stripe_customer_id");
