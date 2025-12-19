-- Story 5.1: Row-Level Security Policies for Workspace Multi-Tenancy
-- This migration enables RLS on all workspace-scoped tables and creates
-- policies to ensure users can only access data in their workspaces.

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE law_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE law_list_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTION: Get user's workspace IDs
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_workspace_ids(user_uuid UUID)
RETURNS SETOF UUID AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = user_uuid
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Workspace access policy (user must be member AND workspace not deleted)
DROP POLICY IF EXISTS workspace_member_access ON workspaces;
CREATE POLICY workspace_member_access ON workspaces
  FOR ALL USING (
    id IN (SELECT get_user_workspace_ids(auth.uid()))
    AND status != 'DELETED'
  );

-- Workspace members access (via workspace membership)
DROP POLICY IF EXISTS workspace_member_access ON workspace_members;
CREATE POLICY workspace_member_access ON workspace_members
  FOR ALL USING (
    workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
  );

-- Company profile access (via workspace)
DROP POLICY IF EXISTS company_profile_access ON company_profiles;
CREATE POLICY company_profile_access ON company_profiles
  FOR ALL USING (
    workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
  );

-- Law list access (via workspace)
DROP POLICY IF EXISTS law_list_access ON law_lists;
CREATE POLICY law_list_access ON law_lists
  FOR ALL USING (
    workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
  );

-- Law list item access (via law list -> workspace)
DROP POLICY IF EXISTS law_list_item_access ON law_list_items;
CREATE POLICY law_list_item_access ON law_list_items
  FOR ALL USING (
    law_list_id IN (
      SELECT id FROM law_lists
      WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
    )
  );
