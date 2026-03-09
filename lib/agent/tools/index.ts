/**
 * Agent tool registry — barrel export + factory
 * Story 14.7a, Task 3 (AC: 6, 10)
 */

import { createSearchLawsTool } from './search-laws'
import { createGetDocumentDetailsTool } from './get-document-details'
import { createGetChangeDetailsTool } from './get-change-details'
import { createGetCompanyContextTool } from './get-company-context'

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
export function createAgentTools(workspaceId: string) {
  return {
    search_laws: createSearchLawsTool(workspaceId),
    get_document_details: createGetDocumentDetailsTool(),
    get_change_details: createGetChangeDetailsTool(),
    get_company_context: createGetCompanyContextTool(workspaceId),
  }
}
