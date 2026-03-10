/**
 * suggest_followups tool — generate context-aware follow-up question chips
 * Story 14.10: Dynamic follow-up suggestions after change assessment
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { wrapToolResponse } from './utils'

const suggestFollowupsSchema = z.object({
  questions: z
    .array(
      z.object({
        text: z.string().describe('Follow-up question in Swedish'),
        category: z
          .enum(['action', 'deadline', 'context', 'clarification'])
          .optional()
          .describe('Question category for UI grouping'),
      })
    )
    .min(2)
    .max(4)
    .describe('2–4 context-aware follow-up questions'),
})

export function createSuggestFollowupsTool() {
  return tool({
    description: `Föreslå uppföljningsfrågor efter en ändringsbedömning.

Generera 2–4 kontextanpassade uppföljningsfrågor baserat på ändringen,
företagsprofilen och din bedömning. Frågorna visas som klickbara chips
i användargränssnittet.

Använd enbart i slutet av bedömningsflödet. Ingen bekräftelse behövs.`,
    inputSchema: zodSchema(suggestFollowupsSchema),
    execute: async (input) => {
      const startTime = Date.now()
      return wrapToolResponse('suggest_followups', input.questions, startTime)
    },
  })
}
