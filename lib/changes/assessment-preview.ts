/**
 * Helpers for reading the agent's save_assessment(execute:false) preview and
 * turning it into a form pre-fill. Shared by both entry points that open the
 * assessment sidebar:
 *   - the generic chat (chat-message.tsx buildDetailItem)
 *   - the dashboard assess view (change-assessment-view.tsx)
 */

import type { AssessmentStatus, ImpactLevel } from '@prisma/client'

/** The `preview` object returned by save_assessment when execute=false. */
export interface AssessmentPreview {
  changeEventId?: string
  lawListItemId?: string
  impactLevel?: ImpactLevel
  recommendedStatus?: AssessmentStatus
  analysis?: string
  recommendations?: string
}

/** The agent's proposed (not-yet-saved) assessment, ready to pre-fill the form. */
export interface AssessmentRecommendation {
  status: AssessmentStatus
  impactLevel: ImpactLevel
  notes?: string
}

/**
 * Extract the save_assessment preview object from a tool result, if the output
 * is a confirmation-required envelope. Returns null otherwise.
 */
export function getAssessmentPreview(
  output: unknown
): AssessmentPreview | null {
  if (!output || typeof output !== 'object') return null
  const o = output as {
    confirmation_required?: unknown
    preview?: unknown
  }
  if (!o.confirmation_required) return null
  if (!o.preview || typeof o.preview !== 'object') return null
  return o.preview as AssessmentPreview
}

/**
 * Map a preview to a form pre-fill. Requires both a recommended status and an
 * impact level — otherwise there's nothing meaningful to suggest.
 */
export function extractRecommendation(
  preview: AssessmentPreview | null | undefined
): AssessmentRecommendation | null {
  if (!preview?.recommendedStatus || !preview?.impactLevel) return null
  return {
    status: preview.recommendedStatus,
    impactLevel: preview.impactLevel,
    ...(preview.recommendations ? { notes: preview.recommendations } : {}),
  }
}

/** Minimal shape of a UI message we need to scan for tool outputs. */
interface ScannableMessage {
  role?: string
  parts?: Array<unknown>
}

/**
 * Scan chat messages for the most recent save_assessment preview and return its
 * extracted recommendation. Used by the dashboard view, where the agent calls
 * the tool but the view (not the tool row) owns opening the sidebar.
 */
export function findLatestAssessmentRecommendation(
  messages: ReadonlyArray<ScannableMessage>
): AssessmentRecommendation | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const parts = messages[i]?.parts
    if (!Array.isArray(parts)) continue
    for (let j = parts.length - 1; j >= 0; j--) {
      const part = parts[j] as {
        type?: string
        toolName?: string
        state?: string
        output?: unknown
      }
      if (!part || typeof part !== 'object') continue
      const toolName =
        part.toolName ??
        (typeof part.type === 'string' && part.type.startsWith('tool-')
          ? part.type.slice('tool-'.length)
          : undefined)
      if (toolName !== 'save_assessment') continue
      if (part.state !== 'output-available') continue
      const rec = extractRecommendation(getAssessmentPreview(part.output))
      if (rec) return rec
    }
  }
  return null
}
