-- AlterTable: Add context_prefix column for LLM-generated semantic context (Story 14.3)
ALTER TABLE "content_chunks" ADD COLUMN "context_prefix" TEXT;
