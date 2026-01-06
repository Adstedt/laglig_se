-- Story 2.29: Add markdown_content and json_content columns to legal_documents
-- These columns store derived formats from html_content for different use cases:
-- - markdown_content: For Chat/RAG context (readable, no HTML noise)
-- - json_content: For structured queries and programmatic access

-- Add markdown_content column
ALTER TABLE "legal_documents" ADD COLUMN IF NOT EXISTS "markdown_content" TEXT;

-- Add json_content column
ALTER TABLE "legal_documents" ADD COLUMN IF NOT EXISTS "json_content" JSONB;

-- Add comment for documentation
COMMENT ON COLUMN "legal_documents"."markdown_content" IS 'Derived from HTML - for Chat/RAG context';
COMMENT ON COLUMN "legal_documents"."json_content" IS 'Derived from HTML - for structured queries';
