-- Story 14.22: Agent approval cards — PendingAgentAction foundation.
-- Additive migration — two new enums + one new table + additive back-reference
-- relations only (no existing model modified). Zero DROP, zero ALTER COLUMN,
-- zero RENAME on any existing object. Mirrors the additive shape of
-- 20260507120000_add_law_list_import.
--
-- chat_message_id FK is non-null with ON DELETE CASCADE; the FK target is
-- guaranteed to exist by the pre-loop stub ChatMessage written in
-- app/api/chat/route.ts before the tool loop (see
-- docs/architecture/adr-14.22-a-chat-message-fk-timing.md).
--
-- RLS: follows the project pattern (20260430120000_enable_rls_public_tables) —
-- RLS enabled with no policies (default deny for non-bypass roles). Prisma
-- connects as the postgres role (BYPASSRLS), so server-side prisma.* queries
-- are unaffected; this closes the PostgREST/Realtime/anon-key access path.

-- CreateEnum
CREATE TYPE "PendingAgentActionType" AS ENUM ('CREATE_TASK');

-- CreateEnum
CREATE TYPE "PendingAgentActionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "pending_agent_actions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "chat_message_id" TEXT NOT NULL,
    "context_type" "ChatContextType" NOT NULL DEFAULT 'GLOBAL',
    "context_id" TEXT,
    "action_type" "PendingAgentActionType" NOT NULL,
    "status" "PendingAgentActionStatus" NOT NULL DEFAULT 'PENDING',
    "params" JSONB NOT NULL,
    "result_ref" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_agent_actions_scope_idx" ON "pending_agent_actions"("workspace_id", "user_id", "conversation_id", "status");

-- CreateIndex
CREATE INDEX "pending_agent_actions_chat_message_id_idx" ON "pending_agent_actions"("chat_message_id");

-- CreateIndex
CREATE INDEX "pending_agent_actions_expires_at_idx" ON "pending_agent_actions"("expires_at");

-- AddForeignKey
ALTER TABLE "pending_agent_actions" ADD CONSTRAINT "pending_agent_actions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_agent_actions" ADD CONSTRAINT "pending_agent_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_agent_actions" ADD CONSTRAINT "pending_agent_actions_chat_message_id_fkey" FOREIGN KEY ("chat_message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS on the new table (project pattern: see
-- 20260430120000_enable_rls_public_tables for the canonical reference).
ALTER TABLE "public"."pending_agent_actions" ENABLE ROW LEVEL SECURITY;
