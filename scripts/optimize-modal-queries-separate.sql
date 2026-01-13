-- Performance optimization for law list modal queries
-- Run each CREATE INDEX statement SEPARATELY in Supabase SQL Editor
-- These will fix the 5-second modal load time

-- ============================================================================
-- RUN THESE ONE BY ONE (copy/paste each statement individually)
-- ============================================================================

-- 1. Fix slow workspace_members queries (100-200ms → <10ms)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_members_workspace_user 
ON workspace_members(workspace_id, user_id);

-- 2. Fix slow law_lists workspace lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_law_lists_workspace 
ON law_lists(workspace_id);

-- 3. Fix slow task_list_item_links JOIN operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_list_item_links_law_list_item 
ON task_list_item_links(law_list_item_id, task_id);

-- 4. Fix slow evidence task lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_task_id 
ON evidence(task_id);

-- 5. Fix slow tasks position sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_position 
ON tasks(workspace_id, position);

-- 6. Fix VERY SLOW users email lookup (198ms → <5ms) 
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
ON users(email);

-- ============================================================================
-- AFTER RUNNING ALL INDEXES, RUN THIS TO VERIFY:
-- ============================================================================

SELECT 
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname IN (
    'idx_workspace_members_workspace_user',
    'idx_law_lists_workspace',
    'idx_task_list_item_links_law_list_item',
    'idx_evidence_task_id',
    'idx_tasks_position',
    'idx_users_email'
)
ORDER BY tablename, indexname;