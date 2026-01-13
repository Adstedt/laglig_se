-- SAFE Migration: Add Document Visit Tracking (Review Mode)
-- Story P.1: Performance Optimization - Cache Warming Strategy
-- Date: 2025-01-13
--
-- ⚠️  REVIEW THIS CAREFULLY BEFORE RUNNING ⚠️
-- This script is designed to be completely safe and non-destructive

-- ==============================================================================
-- STEP 1: Check what already exists (READ-ONLY)
-- ==============================================================================

-- Check if the table already exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'document_visits'
        ) THEN '⚠️  WARNING: Table document_visits already exists!'
        ELSE '✅ Safe to proceed: Table document_visits does not exist'
    END as table_check;

-- Check for any existing triggers with our name
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.triggers 
            WHERE trigger_name = 'update_document_visits_updated_at'
        ) THEN '⚠️  WARNING: Trigger already exists!'
        ELSE '✅ Safe to proceed: Trigger does not exist'
    END as trigger_check;

-- Show how many documents would get initial visit data
SELECT 
    COUNT(DISTINCT document_id) as documents_to_seed,
    '📊 These are documents that appear in multiple law lists' as explanation
FROM law_list_items
WHERE document_id IS NOT NULL
GROUP BY document_id
HAVING COUNT(*) > 1;

-- ==============================================================================
-- STEP 2: The actual migration (ONLY CREATES, NEVER DESTROYS)
-- ==============================================================================

-- Only create table if it doesn't exist
-- NOTE: document_id is TEXT not UUID because legal_documents.id is TEXT in the schema
CREATE TABLE IF NOT EXISTS document_visits (
    document_id TEXT NOT NULL PRIMARY KEY REFERENCES legal_documents(id) ON DELETE CASCADE,
    visit_count INTEGER NOT NULL DEFAULT 1,
    last_visited TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Only create indexes if they don't exist  
CREATE INDEX IF NOT EXISTS idx_document_visits_count 
    ON document_visits(visit_count DESC);
    
CREATE INDEX IF NOT EXISTS idx_document_visits_last_visited 
    ON document_visits(last_visited DESC);

-- Add helpful comments (safe - only adds metadata)
COMMENT ON TABLE document_visits IS 
    'Tracks document visits for cache warming optimization. Combined with law list data to identify the most accessed documents.';

-- ==============================================================================
-- STEP 3: Create update trigger (with safety check)
-- ==============================================================================

-- First create the function if it doesn't exist (reusable across tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.triggers 
        WHERE trigger_name = 'update_document_visits_updated_at'
    ) THEN
        CREATE TRIGGER update_document_visits_updated_at
            BEFORE UPDATE ON document_visits
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Created trigger update_document_visits_updated_at';
    ELSE
        RAISE NOTICE '⚠️  Trigger already exists, skipping';
    END IF;
END $$;

-- ==============================================================================
-- STEP 4: Seed initial data (SAFE - only inserts, never updates/deletes)
-- ==============================================================================

-- This only ADDS new rows, never modifies existing ones (ON CONFLICT DO NOTHING)
INSERT INTO document_visits (document_id, visit_count, last_visited)
SELECT 
    lli.document_id,
    COUNT(*) * 10 as visit_count, -- Weight law list documents higher initially
    NOW() as last_visited
FROM law_list_items lli
WHERE lli.document_id IS NOT NULL
GROUP BY lli.document_id
HAVING COUNT(*) > 1  -- Only documents in multiple lists (likely popular)
ON CONFLICT (document_id) DO NOTHING; -- SAFE: Skip if already exists

-- ==============================================================================
-- STEP 5: Verification (READ-ONLY)
-- ==============================================================================

-- Show what was created
SELECT 
    'document_visits' as table_name,
    COUNT(*) as row_count,
    pg_size_pretty(pg_total_relation_size('document_visits')) as table_size
FROM document_visits;

-- Show the indexes that were created
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'document_visits';

-- Show top 10 seeded documents (if any)
SELECT 
    dv.document_id,
    ld.document_number,
    ld.title,
    dv.visit_count,
    dv.last_visited
FROM document_visits dv
JOIN legal_documents ld ON ld.id = dv.document_id
ORDER BY dv.visit_count DESC
LIMIT 10;

-- ==============================================================================
-- ROLLBACK COMMANDS (Keep for reference - DO NOT RUN unless needed)
-- ==============================================================================

-- If you need to rollback (THIS WILL DELETE DATA):
-- DROP TRIGGER IF EXISTS update_document_visits_updated_at ON document_visits;
-- DROP TABLE IF EXISTS document_visits CASCADE;

-- ==============================================================================
-- SUCCESS MESSAGE
-- ==============================================================================

SELECT '✅ Migration completed successfully! Document visit tracking is now enabled.' as status;