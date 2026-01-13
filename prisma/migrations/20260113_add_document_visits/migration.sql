-- Create a lightweight table to track document visits for cache warming
-- This helps identify popular public documents that aren't in law lists

CREATE TABLE IF NOT EXISTS document_visits (
    document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
    visit_count INTEGER NOT NULL DEFAULT 1,
    last_visited TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (document_id)
);

-- Index for efficient queries
CREATE INDEX idx_document_visits_count ON document_visits(visit_count DESC);
CREATE INDEX idx_document_visits_last_visited ON document_visits(last_visited DESC);

-- Add a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_document_visits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_document_visits_updated_at_trigger
BEFORE UPDATE ON document_visits
FOR EACH ROW
EXECUTE FUNCTION update_document_visits_updated_at();