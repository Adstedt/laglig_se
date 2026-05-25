/**
 * Agent tool registry — barrel export + factory
 * Story 14.7a, Task 3 (AC: 6, 10)
 */

import { createSearchLawsTool } from './search-laws'
// Story 17.9c: semantic search over the workspace's own uploaded files (USER_FILE).
import { createSearchWorkspaceFilesTool } from './search-workspace-files'
// Story 19.2: read ANY workspace file in full (PDF/image/extracted text).
import { createReadFileTool } from './read-file'
// Story 19.4a: id-resolution / discovery over the company compliance graph.
import { createSearchLawListItemsTool } from './search-law-list-items'
import { createSearchTasksTool } from './search-tasks'
import { createGetDocumentDetailsTool } from './get-document-details'
import { createGetChangeDetailsTool } from './get-change-details'
import { createGetCompanyContextTool } from './get-company-context'
import { createCreateTaskTool } from './create-task'
import { createUpdateComplianceStatusTool } from './update-compliance-status'
import { createSaveAssessmentTool } from './save-assessment'
import { createAddContextNoteTool } from './add-context-note'
import { createSuggestFollowupsTool } from './suggest-followups'
// Story 14.23: extended approval-type write tools.
import { createLinkTaskToDocumentTool } from './link-task-to-document'
import { createLinkDocumentToTaskTool } from './link-document-to-task'
import { createAddObligationTool } from './add-obligation'
import { createAssignTaskTool } from './assign-task'
// Story 14.24: agent-drafted styrdokument approval.
import { createDraftStyrdokumentTool } from './draft-styrdokument'
// Story 19.5: role-based registry filter + per-call decision logging.
import type { WorkspaceRole } from '@prisma/client'
import { hasPermission } from '@/lib/auth/permissions'
import { wrapWithDecisionLog, type DecisionLogContext } from './decision-log'

// Re-export types for consumers
export type {
  ToolMeta,
  ToolResponse,
  WriteToolResponse,
  ToolError,
} from './types'
export {
  wrapToolResponse,
  wrapWriteToolResponse,
  wrapToolError,
  truncateMarkdown,
} from './utils'

/**
 * Factory function that creates all agent tools with workspaceId captured in closure.
 * Avoids leaking SDK-specific API details to callers.
 *
 * Usage:
 * ```ts
 * const tools = createAgentTools(workspaceId)
 * streamText({ model, messages, tools, stopWhen: stepCountIs(5) })
 * ```
 */
/**
 * Story 14.22: optional per-turn context threaded into write tools. `assistantMessageId`
 * is the preallocated id of the stub assistant ChatMessage written before the tool loop
 * (ADR-14.22-A) — write tools stamp it as `PendingAgentAction.chat_message_id`. The
 * context_type/context_id/conversation_id scope the persisted proposal to the chat.
 */
export interface AgentToolContext {
  assistantMessageId?: string
  contextType?: 'GLOBAL' | 'TASK' | 'LAW' | 'CHANGE'
  contextId?: string | null
  conversationId?: string | null
  /** Story 19.5: resolved model name (e.g. "claude-sonnet-4-6") for AgentDecisionLog. */
  modelVersion?: string
  /** Story 19.4a: active LawListItem id — the law-item write tools default to
   *  this when their `lawListItemId` arg is omitted (e.g. in a LAW chat). */
  lawListItemId?: string | undefined
}

/**
 * Story 19.5: every registered tool's tier. AUDITOR (no `tasks:edit`) gets only
 * `read` tools. `web_search` is injected at the route, not by this factory, but is
 * listed for completeness. Exhaustive `satisfies Record<ToolName, …>` — adding a
 * tool without an entry is a compile error.
 */
type ToolName =
  | 'search_laws'
  | 'search_workspace_files'
  | 'read_file'
  | 'search_law_list_items'
  | 'search_tasks'
  | 'get_document_details'
  | 'get_change_details'
  | 'get_company_context'
  | 'suggest_followups'
  | 'web_search'
  | 'create_task'
  | 'update_compliance_status'
  | 'save_assessment'
  | 'add_context_note'
  | 'link_task_to_document'
  | 'link_document_to_task'
  | 'add_obligation'
  | 'assign_task'
  | 'draft_styrdokument'

export const TOOL_REGISTRY_POLICY = {
  search_laws: 'read',
  search_workspace_files: 'read',
  read_file: 'read',
  search_law_list_items: 'read',
  search_tasks: 'read',
  get_document_details: 'read',
  get_change_details: 'read',
  get_company_context: 'read',
  suggest_followups: 'read',
  web_search: 'read',
  create_task: 'write',
  update_compliance_status: 'write',
  save_assessment: 'write',
  add_context_note: 'write',
  link_task_to_document: 'write',
  link_document_to_task: 'write',
  add_obligation: 'write',
  assign_task: 'write',
  draft_styrdokument: 'write',
} satisfies Record<ToolName, 'read' | 'write'>

/** Mutate a tool's `execute` to log every call (Story 19.5). In-place, idempotent-safe. */
function wrapToolExecute(
  name: string,
  toolObj: unknown,
  ctx: DecisionLogContext
): void {
  const t = toolObj as {
    execute?: (_i: unknown, _o?: unknown) => Promise<unknown>
  }
  if (typeof t.execute === 'function') {
    const orig = t.execute.bind(toolObj)
    t.execute = wrapWithDecisionLog(name, orig, ctx)
  }
}

export function createAgentTools(
  workspaceId: string,
  userId: string,
  context?: AgentToolContext,
  role?: WorkspaceRole
) {
  // userId is required by write tools that persist a PendingAgentAction.
  const writeContext = { userId, ...context }
  const tools = {
    search_laws: createSearchLawsTool(workspaceId),
    // Story 17.9c: read-only, additive — never widens the legal search.
    search_workspace_files: createSearchWorkspaceFilesTool(workspaceId),
    // Story 19.2: read ANY workspace file in full (search → read loop).
    read_file: createReadFileTool(workspaceId),
    // Story 19.4a: resolve a law-list item / task by name (GLOBAL-chat entry).
    search_law_list_items: createSearchLawListItemsTool(workspaceId),
    search_tasks: createSearchTasksTool(workspaceId),
    get_document_details: createGetDocumentDetailsTool(),
    get_change_details: createGetChangeDetailsTool(),
    get_company_context: createGetCompanyContextTool(workspaceId),
    create_task: createCreateTaskTool(workspaceId, writeContext),
    // Story 14.23: migrated to the inline pending-action pattern — both now
    // take writeContext so they can persist a PendingAgentAction row.
    update_compliance_status: createUpdateComplianceStatusTool(
      workspaceId,
      writeContext
    ),
    save_assessment: createSaveAssessmentTool(workspaceId, userId),
    add_context_note: createAddContextNoteTool(workspaceId, writeContext),
    suggest_followups: createSuggestFollowupsTool(),
    // Story 14.23: extended approval types.
    link_task_to_document: createLinkTaskToDocumentTool(
      workspaceId,
      writeContext
    ),
    link_document_to_task: createLinkDocumentToTaskTool(
      workspaceId,
      writeContext
    ),
    add_obligation: createAddObligationTool(workspaceId, writeContext),
    assign_task: createAssignTaskTool(workspaceId, writeContext),
    // Story 14.24: propose a full agent-authored styrdokument (DRAFT_DOCUMENT).
    draft_styrdokument: createDraftStyrdokumentTool(workspaceId, writeContext),
  }

  // Story 19.5: wrap every tool's execute to log the invocation (fail-safe).
  const logCtx: DecisionLogContext = {
    workspaceId,
    userId,
    chatMessageId: context?.assistantMessageId ?? null,
    modelVersion: context?.modelVersion ?? 'unknown',
  }
  for (const [name, toolObj] of Object.entries(tools)) {
    wrapToolExecute(name, toolObj, logCtx)
  }

  // Story 19.5: role filter — AUDITOR (lacks `tasks:edit`) receives read tools
  // only. Absent role → full set (backward compat for legacy callers).
  if (role && !hasPermission(role, 'tasks:edit')) {
    // Cast to the full type: a role-filtered registry is only ever passed
    // wholesale to streamText (which iterates whatever keys exist) — no caller
    // accesses a specific tool key off a filtered registry, so claiming the full
    // shape keeps consumers (e.g. generate-law-list) free of spurious `undefined`.
    return Object.fromEntries(
      Object.entries(tools).filter(
        ([name]) => TOOL_REGISTRY_POLICY[name as ToolName] !== 'write'
      )
    ) as typeof tools
  }

  return tools
}
