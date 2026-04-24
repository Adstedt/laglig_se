-- Story 3.15: Scope AI chat history to the authoring user
-- Rebuilds chat_messages indexes to lead with (workspace_id, user_id, ...)
-- to match the new per-user query patterns in app/actions/ai-chat.ts.
--
-- Manual-apply workflow: this SQL is intended to be run directly against the
-- Supabase production database. For current chat_messages sizes a standard
-- blocking CREATE INDEX is appropriate. If the table has grown large enough
-- to warrant a non-blocking rebuild, see the Tertiary Risk note in the story
-- for the CONCURRENTLY variant (requires bypassing Prisma's transaction wrap).

-- DropIndex
DROP INDEX "chat_messages_workspace_id_context_type_context_id_idx";

-- DropIndex
DROP INDEX "chat_messages_workspace_id_created_at_idx";

-- DropIndex
DROP INDEX "chat_messages_user_id_idx";

-- CreateIndex
CREATE INDEX "chat_messages_workspace_id_user_id_context_type_context_id_idx" ON "chat_messages"("workspace_id", "user_id", "context_type", "context_id");

-- CreateIndex
CREATE INDEX "chat_messages_workspace_id_user_id_created_at_idx" ON "chat_messages"("workspace_id", "user_id", "created_at");
