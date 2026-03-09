/**
 * save_assessment tool — persist a change assessment (stub until Story 14.10)
 * Story 14.7c, Task 3 (AC: 3)
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'

const saveAssessmentSchema = z.object({
  changeEventId: z.string().describe('ID of the ChangeEvent being assessed'),
  lawListItemId: z
    .string()
    .describe('ID of the LawListItem the assessment relates to'),
  impactLevel: z
    .enum(['HIGH', 'MEDIUM', 'LOW', 'NONE'])
    .describe('Assessed impact level of the change'),
  analysis: z
    .string()
    .describe('Analysis of how the change affects the company'),
  recommendations: z
    .string()
    .describe('Recommended actions based on the assessment'),
  execute: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'false = return proposal for confirmation, true = execute the action'
    ),
})

export function createSaveAssessmentTool(_workspaceId: string) {
  return tool({
    description: `Spara en bedömning av en lagändring (change assessment).

Detta verktyg kommer att spara en strukturerad bedömning av hur en lagändring påverkar
företaget. Det inkluderar konsekvensnivå, analys och rekommendationer.

OBS: ChangeAssessment-modellen skapas i Story 14.10. Tills dess är detta verktyg en
platshållare — bedömningen sparas INTE. Informera användaren om att bedömningspersistens
kommer snart.

Parametrarna definieras fullt ut nu så att gränssnittet är klart när modellen byggs.`,
    inputSchema: zodSchema(saveAssessmentSchema),
    execute: async () => {
      const startTime = Date.now()

      // Stub — ChangeAssessment model not yet created (Story 14.10)
      return {
        confirmation_required: false as const,
        _note:
          'ChangeAssessment-modellen skapas i Story 14.10. Bedömningen har inte sparats.',
        _meta: {
          tool: 'save_assessment',
          executionTimeMs: Date.now() - startTime,
          resultCount: 0,
        },
      }
    },
  })
}
