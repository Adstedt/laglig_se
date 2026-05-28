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
// Story 19.4: lazy entity-readers (node state + ContextHandle neighbours).
import { createGetLawListItemTool } from './get-law-list-item'
import { createGetTaskTool } from './get-task'
import { createListLinkedArtifactsTool } from './list-linked-artifacts'
// Story 19.3: workspace-wide diagnostic aggregates (gap detection).
import { createListBevisGapsTool } from './list-bevis-gaps'
import { createListUnassessedChangesTool } from './list-unassessed-changes'
import { createListOverdueTool } from './list-overdue'
import { createListStaleDocumentsTool } from './list-stale-documents'
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
// Story 14.28: propose an edit to a kravpunkt (UPDATE_REQUIREMENT approval card).
import { createUpdateRequirementTool } from './update-requirement'
import { createAssignTaskTool } from './assign-task'
// Story 14.24: agent-drafted styrdokument approval.
import { createDraftStyrdokumentTool } from './draft-styrdokument'
// Story 14.29: agent-proposed task-comment approval (ADD_TASK_COMMENT inline card).
import { createAddTaskCommentTool } from './add-task-comment'
// Story 19.7a: load a skill's full instructions mid-conversation (skills layer).
import { createActivateSkillTool } from './activate-skill'
// Story 19.7c: per-skill registry narrowing — read an active skill's tool whitelist.
import { getSkillToolWhitelist } from '../skill-loader'
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
  | 'get_law_list_item'
  | 'get_task'
  | 'list_linked_artifacts'
  | 'list_bevis_gaps'
  | 'list_unassessed_changes'
  | 'list_overdue'
  | 'list_stale_documents'
  | 'get_document_details'
  | 'get_change_details'
  | 'get_company_context'
  | 'suggest_followups'
  | 'activate_skill'
  | 'web_search'
  | 'create_task'
  | 'update_compliance_status'
  | 'save_assessment'
  | 'add_context_note'
  | 'link_task_to_document'
  | 'link_document_to_task'
  | 'add_obligation'
  | 'update_requirement'
  | 'assign_task'
  | 'draft_styrdokument'
  | 'add_task_comment'

export const TOOL_REGISTRY_POLICY = {
  search_laws: 'read',
  search_workspace_files: 'read',
  read_file: 'read',
  search_law_list_items: 'read',
  search_tasks: 'read',
  get_law_list_item: 'read',
  get_task: 'read',
  list_linked_artifacts: 'read',
  list_bevis_gaps: 'read',
  list_unassessed_changes: 'read',
  list_overdue: 'read',
  list_stale_documents: 'read',
  get_document_details: 'read',
  get_change_details: 'read',
  get_company_context: 'read',
  suggest_followups: 'read',
  activate_skill: 'read',
  web_search: 'read',
  create_task: 'write',
  update_compliance_status: 'write',
  save_assessment: 'write',
  add_context_note: 'write',
  link_task_to_document: 'write',
  link_document_to_task: 'write',
  add_obligation: 'write',
  update_requirement: 'write',
  assign_task: 'write',
  draft_styrdokument: 'write',
  add_task_comment: 'write',
} satisfies Record<ToolName, 'read' | 'write'>

/**
 * Story 19.7c: tools meaningless outside a specific skill — gated behind an
 * active skill's whitelist. Today only `save_assessment` (it persists a
 * ChangeAssessment and requires a `changeEventId`, so it is inherently a
 * change-assessment action; its out-of-change use was already broken — SA-001).
 * Every other factory tool — all reads + the ad-hoc write tools — is universally
 * useful and lives in ALWAYS_AVAILABLE.
 */
const SKILL_GATED_TOOLS = new Set<ToolName>(['save_assessment'])

/**
 * Story 19.7c: the universal baseline. `createAgentTools(…, activeSkills)` narrows
 * the registry to `ALWAYS_AVAILABLE ∪ (active skills' whitelists)`. Derived from the
 * policy (minus the route-injected `web_search`, which this factory never builds)
 * so a newly-added tool is always-available by default unless explicitly gated.
 */
const ALWAYS_AVAILABLE: ReadonlySet<ToolName> = new Set(
  (Object.keys(TOOL_REGISTRY_POLICY) as ToolName[]).filter(
    (name) => name !== 'web_search' && !SKILL_GATED_TOOLS.has(name)
  )
)

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
  role?: WorkspaceRole,
  // Story 19.7c: narrow the registry to ALWAYS_AVAILABLE ∪ these skills' whitelists.
  // `undefined` → no narrowing (legacy callers); `[]` → baseline only.
  activeSkills?: string[]
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
    // Story 19.4: lazy entity-readers — receive writeContext for the id defaults
    // (lawListItemId / contextType / contextId) per NH-1.
    get_law_list_item: createGetLawListItemTool(workspaceId, writeContext),
    list_linked_artifacts: createListLinkedArtifactsTool(
      workspaceId,
      writeContext
    ),
    get_task: createGetTaskTool(workspaceId, writeContext),
    // Story 19.3: workspace-wide diagnostics — read-tier, no context needed
    // (aggregates with no entry-node id; scope is the closure workspaceId).
    list_bevis_gaps: createListBevisGapsTool(workspaceId),
    list_unassessed_changes: createListUnassessedChangesTool(workspaceId),
    list_overdue: createListOverdueTool(workspaceId),
    list_stale_documents: createListStaleDocumentsTool(workspaceId),
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
    // Story 19.7a: load a skill's instructions mid-conversation ('read' tier).
    activate_skill: createActivateSkillTool(),
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
    // Story 14.28: propose a kravpunkt edit (UPDATE_REQUIREMENT pending action).
    update_requirement: createUpdateRequirementTool(workspaceId, writeContext),
    assign_task: createAssignTaskTool(workspaceId, writeContext),
    // Story 14.24: propose a full agent-authored styrdokument (DRAFT_DOCUMENT).
    draft_styrdokument: createDraftStyrdokumentTool(workspaceId, writeContext),
    // Story 14.29: propose a comment on a task (ADD_TASK_COMMENT approval card).
    add_task_comment: createAddTaskCommentTool(workspaceId, writeContext),
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

  // Story 19.5 + 19.7c: one `allowed()` predicate composes the role filter
  // (AUDITOR, lacking `tasks:edit`, gets read tools only) with per-skill
  // narrowing. Both default to "no filtering" so legacy callers (no role, no
  // activeSkills) receive the full set.
  const roleReadOnly = role != null && !hasPermission(role, 'tasks:edit')
  // activeSkills === undefined → no narrowing (legacy). [] → narrow to the
  // baseline. [skills] → baseline ∪ those skills' declared whitelists.
  const skillTools =
    activeSkills === undefined
      ? null
      : new Set<string>([
          ...ALWAYS_AVAILABLE,
          ...activeSkills.flatMap((s) => getSkillToolWhitelist(s)),
        ])

  const allowed = (name: ToolName): boolean => {
    if (roleReadOnly && TOOL_REGISTRY_POLICY[name] === 'write') return false
    if (skillTools && !skillTools.has(name)) return false
    return true
  }

  // No filtering needed → return the full set as-is.
  if (!roleReadOnly && !skillTools) return tools

  // Cast to the full type: a filtered registry is only ever passed wholesale to
  // streamText (which iterates whatever keys exist) — no caller reads a specific
  // tool key off a filtered registry, so claiming the full shape keeps consumers
  // (e.g. generate-law-list) free of spurious `undefined`.
  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => allowed(name as ToolName))
  ) as typeof tools
}
