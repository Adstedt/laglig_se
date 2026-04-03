/**
 * get_template_laws tool — curated law recommendations from LawListTemplate data
 * Story 16.4, Task 2 (AC: 3)
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapToolResponse, wrapToolError } from './utils'

const getTemplateLawsSchema = z.object({
  area: z
    .string()
    .describe(
      'Regulatory area to look up, e.g. "arbetsmiljö", "miljö", "dataskydd", "bolagsrätt"'
    ),
})

export function createGetTemplateLawsTool() {
  return tool({
    description: `Hämta kurerade lagrekommendationer för ett givet regelområde från expertmallar.

Använd detta verktyg för att få professionellt kurerade lagförslag för ett specifikt regelområde
(t.ex. "arbetsmiljö", "miljö", "dataskydd"). Mallarna innehåller lagar som experter har valt ut
som relevanta för det området.

Utvärdera varje föreslagen lag mot företagsprofilen — behåll det som är tillämpligt, hoppa över
det som inte passar. Om inget mallar finns för ett område, returneras en tom lista — använd då
search_laws istället.

Verktyget tar en parameter: area (regelområde som sökterm).`,
    inputSchema: zodSchema(getTemplateLawsSchema),
    execute: async ({ area }) => {
      const startTime = Date.now()

      try {
        // Find published templates matching the area (search by domain or name)
        const areaLower = area.toLowerCase()

        const templates = await prisma.lawListTemplate.findMany({
          where: {
            status: 'PUBLISHED',
            OR: [
              { domain: { contains: areaLower, mode: 'insensitive' } },
              { name: { contains: areaLower, mode: 'insensitive' } },
              { slug: { contains: areaLower, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            name: true,
            items: {
              select: {
                document_id: true,
                compliance_summary: true,
                expert_commentary: true,
                document: {
                  select: {
                    id: true,
                    title: true,
                    document_number: true,
                    applicability_hint: true,
                    summary: true,
                    kommentar: true,
                  },
                },
              },
              orderBy: { position: 'asc' },
            },
          },
        })

        if (templates.length === 0) {
          return wrapToolResponse(
            'get_template_laws',
            {
              area,
              laws: [],
              templateName: null,
              itemCount: 0,
            },
            startTime,
            0
          )
        }

        // Use the first matching template (most relevant)
        const template = templates[0]!

        const laws = template.items.map((item) => ({
          documentId: item.document_id,
          title: item.document.title,
          sfsNumber: item.document.document_number,
          applicability: item.document.applicability_hint ?? null,
          description:
            item.compliance_summary ?? item.document.kommentar ?? null,
          expertNote: item.expert_commentary ?? item.document.summary ?? null,
        }))

        return wrapToolResponse(
          'get_template_laws',
          {
            area,
            laws,
            templateName: template.name,
            itemCount: laws.length,
          },
          startTime,
          laws.length
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'get_template_laws',
          `Kunde inte hämta mallagar för "${area}": ${message}`,
          'Ett tekniskt fel uppstod. Försök med ett annat regelområde eller använd search_laws istället.',
          startTime
        )
      }
    },
  })
}
