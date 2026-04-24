-- Story 14.27: Chat usage telemetry — per-turn ChatUsageEvent log
-- One row per successful chat turn (onFinish callback in app/api/chat/route.ts).
-- Captures six token dimensions + step count + cost estimate per (workspace, user).
--
-- Manual-apply workflow: this SQL is intended to be run directly against the
-- Supabase database (repo convention; `prisma migrate dev` is blocked by a
-- historical type-mismatch migration that fails shadow-DB rebuild).
-- Purely additive: one new table, four indexes, two FKs. No existing rows affected.

-- CreateTable
CREATE TABLE "chat_usage_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "context_type" "ChatContextType" NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_read_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_write_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "reasoning_tokens" INTEGER NOT NULL DEFAULT 0,
    "step_count" INTEGER NOT NULL DEFAULT 1,
    "cost_usd_estimate" DECIMAL(10,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_usage_events_workspace_id_created_at_idx" ON "chat_usage_events"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_usage_events_user_id_created_at_idx" ON "chat_usage_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_usage_events_workspace_id_user_id_created_at_idx" ON "chat_usage_events"("workspace_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_usage_events_context_type_created_at_idx" ON "chat_usage_events"("context_type", "created_at");

-- AddForeignKey
ALTER TABLE "chat_usage_events" ADD CONSTRAINT "chat_usage_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_usage_events" ADD CONSTRAINT "chat_usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
