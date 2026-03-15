-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN "conversation_id" TEXT;

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_idx" ON "chat_messages"("conversation_id");
