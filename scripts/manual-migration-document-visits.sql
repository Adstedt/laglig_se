-- Manual Migration: Add Document Visit Tracking
-- Story P.1: Performance Optimization - Cache Warming Strategy
-- Date: 2025-01-13
-- 
-- This adds visit tracking to identify popular documents for cache warming.
-- The combination of law list usage + public visits gives us optimal cache coverage.

-- SAFETY CHECK: Verify we're not overwriting an existing table
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'document_visits') THEN
        RAISE NOTICE 'Table document_visits already exists - skipping creation';
    ELSE
        -- Create document visits table (SAFE - only if not exists)
        CREATE TABLE document_visits (
            document_id UUID NOT NULL PRIMARY KEY REFERENCES legal_documents(id) ON DELETE CASCADE,
            visit_count INTEGER NOT NULL DEFAULT 1,
            last_visited TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Created table document_visits';
    END IF;
END $$;

-- Add indexes for efficient queries (SAFE - IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_document_visits_count ON document_visits(visit_count DESC);
CREATE INDEX IF NOT EXISTS idx_document_visits_last_visited ON document_visits(last_visited DESC);

-- Add comment explaining the table's purpose
COMMENT ON TABLE document_visits IS 'Tracks document visits for cache warming optimization. Combined with law list data to identify the most accessed documents.';
COMMENT ON COLUMN document_visits.visit_count IS 'Number of times this document has been visited in public pages';
COMMENT ON COLUMN document_visits.last_visited IS 'Last time this document was accessed, used for cache freshness';

-- Create or replace function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at (SAFE - DROP IF EXISTS is safe here)
-- Only drops the specific trigger we're about to create, not any data
DROP TRIGGER IF EXISTS update_document_visits_updated_at ON document_visits;
CREATE TRIGGER update_document_visits_updated_at
    BEFORE UPDATE ON document_visits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed initial data (optional - populates visits for existing popular documents)
-- This helps cache warming work immediately even before real visits accumulate
INSERT INTO document_visits (document_id, visit_count)
SELECT 
    lli.document_id,
    COUNT(*) * 10 as visit_count -- Multiply by 10 to give law list docs initial weight
FROM law_list_items lli
WHERE lli.document_id IS NOT NULL
GROUP BY lli.document_id
HAVING COUNT(*) > 1  -- Only seed documents that appear in multiple lists
ON CONFLICT (document_id) DO NOTHING;

-- Verify the migration worked
DO $$
DECLARE
    table_exists boolean;
    index_count integer;
BEGIN
    -- Check if table was created
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'document_visits'
    ) INTO table_exists;
    
    -- Count indexes
    SELECT COUNT(*) 
    FROM pg_indexes 
    WHERE tablename = 'document_visits'
    INTO index_count;
    
    -- Report results
    IF table_exists THEN
        RAISE NOTICE '✅ Table document_visits created successfully';
        RAISE NOTICE '✅ Created % indexes on document_visits', index_count;
    ELSE
        RAISE EXCEPTION '❌ Failed to create document_visits table';
    END IF;
END $$;

-- Rollback commands (if needed)
-- DROP TRIGGER IF EXISTS update_document_visits_updated_at ON document_visits;
-- DROP TABLE IF EXISTS document_visits CASCADE;