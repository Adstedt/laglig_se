-- Performance optimization for law list modal queries
-- These indexes will reduce the 5-second load time to <500ms

-- 1. Optimize workspace_members queries (currently 100-200ms)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_members_workspace_user 
ON workspace_members(workspace_id, user_id);

-- 2. Optimize law_list_items primary key lookup (already has primary key index, skip)

-- 3. Optimize law_lists workspace lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_law_lists_workspace 
ON law_lists(workspace_id);

-- 4. Optimize task_list_item_links for JOIN operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_list_item_links_law_list_item 
ON task_list_item_links(law_list_item_id, task_id);

-- 5. Optimize evidence task lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_task_id 
ON evidence(task_id);

-- 6. Optimize tasks position sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_position 
ON tasks(workspace_id, position);

-- 7. Optimize users email lookup (currently 198ms!)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
ON users(email);

-- 8. Optimize workspaces primary key lookup (should already have it, but verify)
-- Primary keys already have indexes by default

-- Check existing indexes to avoid duplicates
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('workspace_members', 'law_lists', 'task_list_item_links', 'evidence', 'tasks', 'users')
ORDER BY tablename, indexname;