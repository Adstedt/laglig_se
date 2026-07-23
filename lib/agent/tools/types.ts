/**
 * Shared types for agent tools
 * Story 14.7a, Task 1 (AC: 3-5)
 */

export interface ToolMeta {
  tool: string
  executionTimeMs: number
  resultCount: number
  /** Hint for the sidebar behavior when this tool result arrives */
  sidebarHint?: 'open' | 'suggest' | 'none'
}

export interface ToolResponse<T> {
  data: T
  _meta: ToolMeta
}

export interface WriteToolResponse<T> {
  confirmation_required: true
  action: string
  params: Record<string, unknown>
  preview: string
  data?: T
  _meta: ToolMeta
}

export interface ToolError {
  error: true
  message: string
  guidance: string
  _meta: ToolMeta
}

/**
 * Story 19.4: a typed pointer to a neighbour node in the compliance graph.
 * The entity-readers return handles (not fully-hydrated neighbours) so the agent
 * traverses edges on demand. One shape across every reader = one traversal grammar.
 */
export interface ContextHandle {
  id: string
  type:
    | 'law_item'
    | 'task'
    | 'document'
    | 'file'
    | 'requirement'
    | 'change_assessment'
    | 'finding'
    // Story 29.1: Epic 21 cycle-graph nodes (list_cycles / get_cycle / get_finding).
    | 'cycle'
    | 'audit_item'
    | 'report'
  label: string
  count?: number
}
