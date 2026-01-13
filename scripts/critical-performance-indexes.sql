-- CRITICAL PERFORMANCE INDEXES FOR MODAL SPEED
-- These fix the 5+ second first load time
-- Run each CREATE INDEX statement SEPARATELY in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Check what indexes already exist
-- ============================================================================
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'workspace_members', 'law_list_items', 'law_lists', 'tasks', 'evidence')
ORDER BY tablename, indexname;

-- ============================================================================
-- STEP 2: Create missing indexes (RUN EACH ONE SEPARATELY)
-- ============================================================================

-- 1. Fix SUPER SLOW user email lookup (1446ms -> <5ms)
-- This is called on EVERY request for authentication
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
ON users(email);

-- 2. Fix SUPER SLOW workspace member lookup (1697ms -> <10ms)  
-- This is also called on EVERY request for workspace context
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_members_user_workspace
ON workspace_members(user_id, workspace_id);

-- 3. Additional index for workspace_id alone (for list queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_members_workspace
ON workspace_members(workspace_id);

-- 4. Law list items primary key should already be indexed, but verify
-- If not indexed, this helps with direct lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_law_list_items_document
ON law_list_items(document_id);

-- 5. Law lists workspace lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_law_lists_workspace
ON law_lists(workspace_id);

-- ============================================================================
-- STEP 3: Verify the indexes were created
-- ============================================================================
SELECT 
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname IN (
    'idx_users_email',
    'idx_workspace_members_user_workspace',
    'idx_workspace_members_workspace',
    'idx_law_list_items_document',
    'idx_law_lists_workspace'
)
ORDER BY tablename, indexname;

-- ============================================================================
-- EXPECTED RESULTS AFTER INDEXES:
-- ============================================================================
-- Before: Modal first load = 5+ seconds
--   - User query: 1446ms
--   - Member query: 1697ms
--   - Total auth: 2.7s
--
-- After: Modal first load = ~1 second
--   - User query: <5ms
--   - Member query: <10ms
--   - Total auth: <50ms