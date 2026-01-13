-- RUN THIS ENTIRE BLOCK IN SUPABASE SQL EDITOR
-- These will fix the 8-second performance issue with the law modal
-- You can paste and run all commands at once

-- 1. CRITICAL: Index for document lookups (fixes modal loading)
CREATE INDEX IF NOT EXISTS idx_law_list_items_document_id 
ON law_list_items(document_id);

-- 2. CRITICAL: Index for law_list filtering (most common query)
CREATE INDEX IF NOT EXISTS idx_law_list_items_list_id 
ON law_list_items(law_list_id);

-- 3. Composite index for list + position (drag-and-drop queries)
CREATE INDEX IF NOT EXISTS idx_law_list_items_list_position 
ON law_list_items(law_list_id, position);

-- 4. Index for compliance status filtering (kanban board)
CREATE INDEX IF NOT EXISTS idx_law_list_items_status 
ON law_list_items(compliance_status);

-- 5. Index for responsible user filtering
CREATE INDEX IF NOT EXISTS idx_law_list_items_responsible 
ON law_list_items(responsible_user_id) 
WHERE responsible_user_id IS NOT NULL;

-- 6. Index for due date filtering
CREATE INDEX IF NOT EXISTS idx_law_list_items_due_date
ON law_list_items(due_date) 
WHERE due_date IS NOT NULL;

-- 7. Index for priority filtering  
CREATE INDEX IF NOT EXISTS idx_law_list_items_priority
ON law_list_items(priority);

-- 8. Index for position ordering
CREATE INDEX IF NOT EXISTS idx_law_list_items_position 
ON law_list_items(position);

-- VERIFY INDEXES WERE CREATED:
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename = 'law_list_items' 
ORDER BY indexname;