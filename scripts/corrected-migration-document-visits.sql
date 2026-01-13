-- CORRECTED Migration: Add Document Visit Tracking
-- Fixed: document_id is TEXT not UUID to match legal_documents.id type
-- Date: 2025-01-13

-- Create table with correct data type
CREATE TABLE IF NOT EXISTS document_visits (
    document_id TEXT NOT NULL PRIMARY KEY REFERENCES legal_documents(id) ON DELETE CASCADE,
    visit_count INTEGER NOT NULL DEFAULT 1,
    last_visited TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_document_visits_count ON document_visits(visit_count DESC);
CREATE INDEX IF NOT EXISTS idx_document_visits_last_visited ON document_visits(last_visited DESC);

-- Add comments
COMMENT ON TABLE document_visits IS 'Tracks document visits for cache warming. Combined with law lists to identify popular documents.';

-- Create update function and trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
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
    END IF;
END $$;

-- Seed initial data from law lists (popular documents)
INSERT INTO document_visits (document_id, visit_count, last_visited)
SELECT 
    lli.document_id,
    COUNT(*) * 10 as visit_count,
    NOW() as last_visited
FROM law_list_items lli
WHERE lli.document_id IS NOT NULL
GROUP BY lli.document_id
HAVING COUNT(*) > 1
ON CONFLICT (document_id) DO NOTHING;

-- Verify
SELECT 
    'Migration completed!' as status,
    COUNT(*) as seeded_documents,
    'Documents from law lists have been pre-seeded with visit data' as note
FROM document_visits;