-- Story 24.3: enable pg_trgm for the import-pipeline matcher's title-similarity
-- query (lib/search/match-candidates.ts). pg_trgm provides the `similarity()`
-- function and trigram-indexable predicates needed to keep the candidate
-- retrieval under the 500ms p95 budget on a ~10k-document catalog.
--
-- Verified prior to migration: extension was NOT installed (pg_extension query
-- returned empty), and no trigram indexes existed on legal_documents.
--
-- Idempotent: CREATE EXTENSION IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index over title for trigram similarity searches.
-- gin_trgm_ops is the operator class registered by pg_trgm.
CREATE INDEX IF NOT EXISTS legal_documents_title_trgm_idx
  ON "legal_documents"
  USING gin (title gin_trgm_ops);
