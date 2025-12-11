-- Story 2.19: Add composite indexes for optimized catalogue/browse queries
-- These indexes significantly improve query performance for:
-- 1. Default catalogue browsing (sorted by effective_date desc)
-- 2. Filtered catalogue browsing (by content_type, status, effective_date)
-- 3. Court case browsing (sorted by publication_date desc)

-- Composite index for browse queries with content_type, status, and effective_date filters
-- Covers: Default catalogue, filtered by content type, filtered by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_browse_composite
ON legal_documents (content_type, status, effective_date DESC);

-- Composite index for browse queries with just content_type and effective_date
-- Covers: Content-type specific browsing without status filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_browse_content_date
ON legal_documents (content_type, effective_date DESC);

-- Index on publication_date for court case sorting
-- Covers: Court case browsing sorted by most recent publication
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_publication_date
ON legal_documents (publication_date DESC);

-- Note: These indexes use CONCURRENTLY to avoid locking the table during creation
-- This is safe to run on production databases with live traffic
