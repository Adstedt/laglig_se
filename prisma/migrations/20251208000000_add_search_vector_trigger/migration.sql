-- Story 2.7: Add search vector trigger and GIN index for full-text search
-- SIMPLIFIED APPROACH: Only index title, document_number, and summary
-- full_text search will be added later via pgvector/embeddings for semantic search

-- Drop existing regular index on search_vector if exists
DROP INDEX IF EXISTS "legal_documents_search_vector_idx";

-- Create GIN index for full-text search performance
CREATE INDEX IF NOT EXISTS idx_legal_documents_search_vector_gin
  ON legal_documents USING GIN(search_vector);

-- Create function for search vector generation with weighted ranking
-- Weight A (highest): title, document_number - exact matches on identifiers
-- Weight B (medium): summary - AI-generated summaries are highly relevant
-- NOTE: full_text is NOT included - will be searchable via pgvector later
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

-- Create trigger for automatic search_vector updates
DROP TRIGGER IF EXISTS legal_document_search_vector_trigger ON legal_documents;
CREATE TRIGGER legal_document_search_vector_trigger
  BEFORE INSERT OR UPDATE ON legal_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_legal_document_search_vector();
