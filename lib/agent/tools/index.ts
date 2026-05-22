/**
 * Agent tool registry — barrel export + factory
 * Story 14.7a, Task 3 (AC: 6, 10)
 */

import { createSearchLawsTool } from './search-laws'
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
}

export function createAgentTools(
  workspaceId: string,
  userId: string,
  context?: AgentToolContext
) {
  // userId is required by write tools that persist a PendingAgentAction.
  const writeContext = { userId, ...context }
  return {
    search_laws: createSearchLawsTool(workspaceId),
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
}
