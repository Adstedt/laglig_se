/**
 * get_company_context tool — company profile + compliance posture
 * Story 14.7b, Task 1 (AC: 1-4, 6)
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapToolResponse, wrapToolError } from './utils'

const companyContextSchema = z.object({})

export function createGetCompanyContextTool(workspaceId: string) {
  return tool({
    description: `Hämta företagets profil och efterlevnadsstatus (compliance posture).

Använd detta verktyg när du behöver förstå vem användaren är och hur deras efterlevnadsläge ser ut.
Det returnerar: företagsprofil (namn, org.nummer, SNI-kod, bransch, storlek, verksamhetsbeskrivning),
skattestatus (F-skatt, moms, arbetsgivare), utlandsägande, FI-reglering, pågående förfaranden,
en sammanfattning av bevakningslistor med antal lagar, fördelning av efterlevnadsstatus,
och antal väntande lagändringar som inte har hanterats.

dataSource anger datakällan: "bolagsapi" (auktoritativ från Bolagsverket) eller "manual" (användarinmatad).

Verktyget tar inga parametrar — arbetsytan (workspace) bestäms automatiskt.

Om profilen inte är fullständigt ifylld (t.ex. SNI-kod saknas) markeras det med profileComplete: false.
Uppmana då användaren att fylla i sin företagsprofil under Inställningar för bättre rådgivning.

Returnerar alltid data även om vissa fält är tomma — använd det som finns.`,
    inputSchema: zodSchema(companyContextSchema),
    execute: async () => {
      const startTime = Date.now()

      try {
        // Fetch company profile directly (avoid server action cookie dependency)
        let profile = await prisma.companyProfile.findUnique({
          where: { workspace_id: workspaceId },
        })

        // Auto-create profile if none exists (mirrors server action upsert behavior)
        if (!profile) {
          const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { name: true },
          })

          profile = await prisma.companyProfile.create({
            data: {
              workspace_id: workspaceId,
              company_name: workspace?.name ?? 'Okänt företag',
            },
          })
        }

        // Parallel queries for law lists, compliance distribution, and change count
        const [lawLists, complianceDistribution, changeCountResult] =
          await Promise.all([
            prisma.lawList.findMany({
              where: { workspace_id: workspaceId },
              select: {
                name: true,
                _count: { select: { items: true } },
              },
            }),
            prisma.lawListItem.groupBy({
              by: ['compliance_status'],
              where: { law_list: { workspace_id: workspaceId } },
              _count: true,
            }),
            prisma.$queryRaw<[{ count: bigint }]>`
              SELECT COUNT(*) as count
              FROM change_events ce
              JOIN law_list_items lli ON lli.document_id = ce.document_id
              JOIN law_lists ll ON ll.id = lli.law_list_id
              WHERE ll.workspace_id = ${workspaceId}
                AND (
                  lli.last_change_acknowledged_at IS NULL
                  OR ce.detected_at > lli.last_change_acknowledged_at
                )
            `,
          ])

        const unacknowledgedChangeCount = Number(
          changeCountResult[0]?.count ?? 0
        )

        // Determine profile completeness
        const profileComplete = (profile.profile_completeness ?? 0) >= 80

        const data = {
          companyName: profile.company_name,
          orgNumber: profile.org_number ?? null,
          sniCode: profile.sni_code ?? null,
          industryLabel: profile.industry_label ?? null,
          employeeCountRange: profile.employee_count_range ?? null,
          organizationType: profile.organization_type ?? null,
          complianceMaturity: profile.compliance_maturity ?? null,
          hasComplianceOfficer: profile.has_compliance_officer,
          certifications: profile.certifications ?? [],
          profileCompleteness: profile.profile_completeness ?? 0,
          profileComplete,
          businessDescription: profile.business_description ?? null,
          taxStatus: profile.tax_status ?? null,
          foreignOwned: profile.foreign_owned,
          parentCompanyName: profile.parent_company_name ?? null,
          fiRegulated: profile.fi_regulated,
          ongoingProcedures: profile.ongoing_procedures ?? null,
          activeStatus: profile.active_status ?? null,
          registeredDate: profile.registered_date?.toISOString() ?? null,
          dataSource: profile.data_source ?? null,
          lastEnrichedAt: profile.last_enriched_at?.toISOString() ?? null,
          lawLists: lawLists.map((list) => ({
            name: list.name,
            itemCount: list._count.items,
          })),
          complianceStatusDistribution: Object.fromEntries(
            complianceDistribution.map((row) => [
              row.compliance_status,
              row._count,
            ])
          ),
          unacknowledgedChangeCount,
        }

        return wrapToolResponse('get_company_context', data, startTime)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'get_company_context',
          `Kunde inte hämta företagskontext: ${message}`,
          'Ett tekniskt fel uppstod vid hämtning av företagsprofilen. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}
