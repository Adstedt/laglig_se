-- Story 2.7: Add search vector trigger and GIN index for full-text search
-- SIMPLIFIED APPROACH: Only index title, document_number, and summary
-- full_text search will be added later via pgvector/embeddings for semantic search
--
-- Run this in parts in Supabase SQL Editor

-- PART 1: Drop existing regular index and create GIN index
DROP INDEX IF EXISTS "legal_documents_search_vector_idx";

CREATE INDEX IF NOT EXISTS idx_legal_documents_search_vector_gin
  ON legal_documents USING GIN(search_vector);

-- PART 2: Create function for search vector generation
-- NOTE: Only indexes title, document_number, and summary (NOT full_text)
CREATE OR REPLACE FUNCTION update_legal_document_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('pg_catalog.swedish', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('pg_catalog.swedish', coalesce(NEW.document_number, '')), 'A') ||
    setweight(to_tsvector('pg_catalog.swedish', coalesce(NEW.summary, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PART 3: Create trigger
DROP TRIGGER IF EXISTS legal_document_search_vector_trigger ON legal_documents;
CREATE TRIGGER legal_document_search_vector_trigger
  BEFORE INSERT OR UPDATE ON legal_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_legal_document_search_vector();

-- PART 4: Backfill in batches (run multiple times if needed)
-- This is now MUCH faster since we're not indexing full_text
UPDATE legal_documents
SET search_vector =
  setweight(to_tsvector('pg_catalog.swedish', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('pg_catalog.swedish', coalesce(document_number, '')), 'A') ||
  setweight(to_tsvector('pg_catalog.swedish', coalesce(summary, '')), 'B')
WHERE id IN (
  SELECT id FROM legal_documents
  WHERE search_vector IS NULL
  LIMIT 1000
);

-- Repeat PART 4 until no more NULL search_vectors

-- PART 5: Analyze table
ANALYZE legal_documents;
