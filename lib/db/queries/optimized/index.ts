/**
 * Story P.3: Optimized Query Exports
 *
 * Centralized exports for all optimized database queries.
 */

// Law List Queries
export {
  getLawListItemsPaginated,
  getLawListSummaries,
  getLawListWithGroups,
  batchFetchDocuments,
  updateLawListItem,
  type PaginatedLawListItemsResult,
  type LawListItemWithDocument,
  type LawListSummary,
} from './law-list'

// Workspace Queries
export {
  getWorkspaceOverview,
  getWorkspaceMembers,
  getWorkspaceDashboardData,
  getUserWorkspaces,
  checkWorkspaceAccess,
  type WorkspaceOverview,
  type WorkspaceMemberWithRole,
  type WorkspaceDashboardData,
} from './workspace'
