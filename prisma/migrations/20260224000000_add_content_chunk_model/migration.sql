-- Story 14.2: ContentChunk model & chunking pipeline
-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('LEGAL_DOCUMENT', 'USER_FILE', 'CONVERSATION', 'ASSESSMENT');

-- CreateEnum
CREATE TYPE "ContentRole" AS ENUM ('STYCKE', 'ALLMANT_RAD', 'TABLE', 'HEADING', 'TRANSITION_PROVISION', 'FOOTNOTE', 'MARKDOWN_CHUNK');

-- CreateTable
CREATE TABLE "content_chunks" (
    "id" TEXT NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "path" TEXT NOT NULL,
    "contextual_header" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_role" "ContentRole" NOT NULL,
    "embedding" vector(1536),
    "token_count" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_chunks_source_type_source_id_idx" ON "content_chunks"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "content_chunks_workspace_id_idx" ON "content_chunks"("workspace_id");

-- CreateIndex: pgvector HNSW index for cosine similarity search
CREATE INDEX "content_chunks_embedding_idx" ON "content_chunks"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
