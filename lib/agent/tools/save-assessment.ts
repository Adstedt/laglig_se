/**
 * save_assessment tool — persist a change assessment
 * Story 14.7c stub → Story 14.10 full implementation
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'

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

export function createSaveAssessmentTool(workspaceId: string, userId: string) {
  return tool({
    description: `Spara en bedömning av en lagändring (change assessment).

Detta verktyg sparar en strukturerad bedömning av hur en lagändring påverkar
företaget. Det inkluderar konsekvensnivå, analys och rekommendationer.

Sätt execute=false först för att visa förhandsgranskning, sedan execute=true för att spara.`,
    inputSchema: zodSchema(saveAssessmentSchema),
    execute: async (input) => {
      const startTime = Date.now()

      // Preview mode — show what will be saved
      if (!input.execute) {
        return {
          confirmation_required: true as const,
          preview: {
            changeEventId: input.changeEventId,
            lawListItemId: input.lawListItemId,
            impactLevel: input.impactLevel,
            analysis: input.analysis,
            recommendations: input.recommendations,
          },
          message:
            'Jag har förberett bedömningen ovan. Vill du att jag sparar den?',
          _meta: {
            tool: 'save_assessment',
            executionTimeMs: Date.now() - startTime,
            resultCount: 0,
          },
        }
      }

      // Execute mode — persist to database
      try {
        const now = new Date()
        const assessment = await prisma.changeAssessment.upsert({
          where: {
            change_event_id_law_list_item_id: {
              change_event_id: input.changeEventId,
              law_list_item_id: input.lawListItemId,
            },
          },
          create: {
            change_event_id: input.changeEventId,
            law_list_item_id: input.lawListItemId,
            workspace_id: workspaceId,
            status: 'REVIEWED',
            impact_level: input.impactLevel,
            ai_analysis: input.analysis,
            ai_recommendations: [input.recommendations],
            assessed_by: userId,
            assessed_at: now,
          },
          update: {
            status: 'REVIEWED',
            impact_level: input.impactLevel,
            ai_analysis: input.analysis,
            ai_recommendations: [input.recommendations],
            assessed_by: userId,
            assessed_at: now,
          },
        })

        // Update acknowledgement timestamp
        await prisma.lawListItem.update({
          where: { id: input.lawListItemId },
          data: {
            last_change_acknowledged_at: now,
            last_change_acknowledged_by: userId,
          },
        })

        return {
          confirmation_required: false as const,
          saved: true,
          assessmentId: assessment.id,
          status: assessment.status,
          message: 'Bedömningen har sparats.',
          _meta: {
            tool: 'save_assessment',
            executionTimeMs: Date.now() - startTime,
            resultCount: 1,
          },
        }
      } catch (error) {
        console.error('[save_assessment] Error:', error)
        return {
          confirmation_required: false as const,
          error: 'Kunde inte spara bedömningen. Försök igen.',
          _meta: {
            tool: 'save_assessment',
            executionTimeMs: Date.now() - startTime,
            resultCount: 0,
          },
        }
      }
    },
  })
}
