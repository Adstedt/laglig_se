/**
 * add_laws_to_list tool — bulk-add laws to a LawList with groups
 * Story 16.4, Task 3 (AC: 3, 14-18)
 *
 * Uses Prisma directly (NOT server actions) because this runs
 * in a headless agent context without cookie-based workspace resolution.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapToolResponse, wrapToolError } from './utils'

const addLawsToListSchema = z.object({
  laws: z
    .array(
      z.object({
        documentId: z.string().describe('ID of the LegalDocument'),
        businessContext: z
          .string()
          .describe(
            'Personalized "Hur påverkar denna lag oss?" text: why relevant, which processes affected, audit context'
          ),
        group: z
          .string()
          .describe(
            'Group name, e.g. "Arbetsrätt", "Bolagsrätt", "Skatt", "Miljö", "Dataskydd"'
          ),
      })
    )
    .describe('Laws to add to the list'),
})

export function createAddLawsToListTool(workspaceId: string, userId: string) {
  return tool({
    description: `Lägg till lagar i arbetsytans laglista i bulk med gruppering och anpassad affärskontext.

Använd detta verktyg för att lägga till en grupp lagar i företagets laglista.
Varje lag måste ha: documentId (från search_laws eller get_template_laws),
businessContext (personlig förklaring av hur lagen påverkar företaget),
och group (regelområdesgrupp, t.ex. "Arbetsrätt", "Miljö", "Dataskydd").

Verktyget skapar automatiskt laglistan "Er laglista" om den inte finns,
skapar grupperna som behövs, och lägger till lagarna.
Dubbletter hoppas över automatiskt.

Verktyget kör direkt utan bekräftelse — detta är en bakgrundsoperation.`,
    inputSchema: zodSchema(addLawsToListSchema),
    execute: async ({ laws }) => {
      const startTime = Date.now()

      try {
        if (laws.length === 0) {
          return wrapToolResponse(
            'add_laws_to_list',
            { listId: null, addedCount: 0, skippedCount: 0, groups: [] },
            startTime,
            0
          )
        }

        const result = await prisma.$transaction(async (tx) => {
          // Find or create the default law list
          let lawList = await tx.lawList.findFirst({
            where: {
              workspace_id: workspaceId,
              is_default: true,
            },
          })

          if (!lawList) {
            lawList = await tx.lawList.create({
              data: {
                workspace_id: workspaceId,
                name: 'Er laglista',
                is_default: true,
                created_by: userId,
              },
            })
          }

          // Validate documentIds exist in LegalDocument table
          const validDocs = await tx.legalDocument.findMany({
            where: {
              id: { in: laws.map((l) => l.documentId) },
              status: { not: 'REPEALED' },
            },
            select: { id: true },
          })
          const validDocIds = new Set(validDocs.map((d) => d.id))

          // Get existing items to prevent duplicates
          const existingItems = await tx.lawListItem.findMany({
            where: { law_list_id: lawList.id },
            select: { document_id: true },
          })
          const existingDocIds = new Set(
            existingItems.map((i) => i.document_id)
          )

          // Filter out invalid IDs and duplicates
          const newLaws = laws.filter(
            (l) =>
              validDocIds.has(l.documentId) && !existingDocIds.has(l.documentId)
          )
          const invalidCount = laws.filter(
            (l) => !validDocIds.has(l.documentId)
          ).length
          const skippedCount = laws.length - newLaws.length

          if (newLaws.length === 0) {
            return {
              listId: lawList.id,
              addedCount: 0,
              skippedCount,
              invalidCount,
              groups: [] as string[],
            }
          }

          // Collect unique group names
          const groupNames = [...new Set(newLaws.map((l) => l.group))]

          // Create or find groups
          const groupMap = new Map<string, string>()
          for (const name of groupNames) {
            const existing = await tx.lawListGroup.findUnique({
              where: {
                law_list_id_name: {
                  law_list_id: lawList.id,
                  name,
                },
              },
            })

            if (existing) {
              groupMap.set(name, existing.id)
            } else {
              // Get max position for ordering
              const maxPos = await tx.lawListGroup.findFirst({
                where: { law_list_id: lawList.id },
                orderBy: { position: 'desc' },
                select: { position: true },
              })
              const newGroup = await tx.lawListGroup.create({
                data: {
                  law_list_id: lawList.id,
                  name,
                  position: (maxPos?.position ?? 0) + 1,
                },
              })
              groupMap.set(name, newGroup.id)
            }
          }

          // Get max position for items
          const maxItemPos = await tx.lawListItem.findFirst({
            where: { law_list_id: lawList.id },
            orderBy: { position: 'desc' },
            select: { position: true },
          })
          let nextPosition = (maxItemPos?.position ?? 0) + 1

          // Bulk create items
          await tx.lawListItem.createMany({
            data: newLaws.map((l) => ({
              law_list_id: lawList!.id,
              document_id: l.documentId,
              business_context: l.businessContext,
              group_id: groupMap.get(l.group)!,
              source: 'ONBOARDING' as const,
              compliance_status: 'EJ_PABORJAD' as const,
              position: nextPosition++,
              added_by: userId,
              last_change_acknowledged_at: new Date(),
            })),
          })

          return {
            listId: lawList.id,
            addedCount: newLaws.length,
            skippedCount,
            invalidCount,
            groups: groupNames,
          }
        })

        return wrapToolResponse(
          'add_laws_to_list',
          result,
          startTime,
          result.addedCount
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'add_laws_to_list',
          `Kunde inte lägga till lagar: ${message}`,
          'Kontrollera att alla documentId:n är giltiga och att arbetsytan finns.',
          startTime
        )
      }
    },
  })
}
