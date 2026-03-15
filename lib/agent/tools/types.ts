/**
 * Shared types for agent tools
 * Story 14.7a, Task 1 (AC: 3-5)
 */

export interface ToolMeta {
  tool: string
  executionTimeMs: number
  resultCount: number
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
