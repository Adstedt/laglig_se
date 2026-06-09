-- Story 19.5: AgentDecisionLog — one row per agent tool invocation (audit trail).
-- Soft refs (chat_message_id, pending_action_id, accepted_by) are plain columns;
-- workspace_id + user_id are FK Cascade (matches ChatUsageEvent).

-- CreateEnum
CREATE TYPE "AgentDecisionOutcome" AS ENUM ('SUCCESS', 'WRITE_PROPOSED', 'WRITE_ACCEPTED', 'WRITE_REJECTED', 'ERROR');

-- CreateTable
CREATE TABLE "agent_decision_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chat_message_id" TEXT,
    "pending_action_id" TEXT,
    "tool_name" TEXT NOT NULL,
    "input_json" JSONB NOT NULL,
    "output_json" JSONB,
    "proposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "accepted_by" TEXT,
    "outcome" "AgentDecisionOutcome" NOT NULL,
    "model_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_decision_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_decision_logs_workspace_id_created_at_idx" ON "agent_decision_logs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_decision_logs_workspace_id_user_id_created_at_idx" ON "agent_decision_logs"("workspace_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_decision_logs_tool_name_created_at_idx" ON "agent_decision_logs"("tool_name", "created_at");

-- CreateIndex
CREATE INDEX "agent_decision_logs_chat_message_id_idx" ON "agent_decision_logs"("chat_message_id");

-- CreateIndex
CREATE INDEX "agent_decision_logs_pending_action_id_idx" ON "agent_decision_logs"("pending_action_id");

-- AddForeignKey
ALTER TABLE "agent_decision_logs" ADD CONSTRAINT "agent_decision_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_decision_logs" ADD CONSTRAINT "agent_decision_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
