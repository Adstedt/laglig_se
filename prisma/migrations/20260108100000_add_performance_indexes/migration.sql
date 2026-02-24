-- Story 6.0: Add missing database indexes for performance optimization
-- These indexes address slow query performance issues identified in production

-- Law list items indexes (fix N+1 queries)
CREATE INDEX IF NOT EXISTS "idx_law_list_items_list_id" 
ON "law_list_items"("law_list_id");

CREATE INDEX IF NOT EXISTS "idx_law_list_items_workspace" 
ON "law_list_items"("law_list_id", "compliance_status");

-- Tasks indexes (optimize kanban board queries)
CREATE INDEX IF NOT EXISTS "idx_tasks_workspace_column" 
ON "tasks"("workspace_id", "column_id");

-- Workspace members indexes (optimize permission checks)
CREATE INDEX IF NOT EXISTS "idx_workspace_members_user_workspace" 
ON "workspace_members"("user_id", "workspace_id");

-- Workspace slug index (optimize workspace lookup by slug)
CREATE INDEX IF NOT EXISTS "idx_workspace_slug" 
ON "workspaces"("slug");

-- Task columns index for workspace queries
CREATE INDEX IF NOT EXISTS "idx_task_columns_workspace" 
ON "task_columns"("workspace_id");

-- Additional composite index for task position queries
CREATE INDEX IF NOT EXISTS "idx_tasks_column_position" 
ON "tasks"("column_id", "position");

-- Index for assignee queries
CREATE INDEX IF NOT EXISTS "idx_tasks_assignee" 
ON "tasks"("assignee_id");