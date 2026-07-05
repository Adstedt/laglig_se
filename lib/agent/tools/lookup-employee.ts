/**
 * lookup_employee tool — name search over the workspace's employees.
 * Story 7.7, Task 2b (user amendment 2026-07-03).
 *
 * Lets the agent handle typed-name questions ("Vilken uppsägningstid har
 * Anna?") without the employee pill, and disambiguate ("två anställda heter
 * Anna"). Returns AT MOST 5 matches.
 *
 * Registration is ROLE-CONDITIONAL: `createAgentTools` only registers this
 * tool when the session role holds `employees:view` — a role without the
 * permission has NO tool at all (not a refusing tool).
 *
 * PII by construction: the Prisma `select` + output mapping form a field
 * ALLOWLIST (namn, anställningsform, anställningsdatum, personaltyp,
 * sysselsättningsgrad, tilldelat avtal {id, name}, aktiv/inaktiv).
 * Personnummer (any form), email, phone and address are never selected and
 * never present in the output — tests assert their ABSENCE.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import {
  employmentFormLabel,
  personelTypeLabel,
  formatEmploymentDate,
  formatFullTimeEquivalent,
  employeeStatusLabel,
} from '@/lib/employees/labels'
import { wrapToolResponse, wrapToolError } from './utils'

const MAX_MATCHES = 5

const lookupEmployeeSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .describe(
      'Namn (eller del av namn) på den anställda, t.ex. "Anna" eller "Anna Svensson"'
    ),
})

type LookupEmployeeInput = z.infer<typeof lookupEmployeeSchema>

export function createLookupEmployeeTool(workspaceId: string) {
  return tool({
    description: `Slå upp en anställd i arbetsytans personalregister via namn (skiftlägesokänslig delsträngsmatchning på för- och efternamn).
Använd detta verktyg när användaren nämner en anställd vid namn och frågan gäller den personens anställning (uppsägningstid, anställningsform, kollektivavtal m.m.).

Returnerar upp till ${MAX_MATCHES} matchningar med \`id\`, namn, anställningsform, anställningsdatum, personaltyp, sysselsättningsgrad, status (Aktiv/Inaktiv) och tilldelat kollektivavtal ({id, name}).
Får du flera matchningar: be användaren förtydliga vilken person som avses.
Har den anställda ett tilldelat kollektivavtal: skicka \`collectiveAgreement.id\` som \`agreementId\` till search_collective_agreements när du söker i avtalet.
Gäller frågan lön/ersättning: skicka \`id\` som \`employeeId\` till get_employee_salary.`,
    inputSchema: zodSchema(lookupEmployeeSchema),
    execute: async ({ name }: LookupEmployeeInput) => {
      const startTime = Date.now()

      try {
        // "Anna Svensson" → every token must match först- OR efternamn;
        // a single token matches either field (plain contains).
        const tokens = name.trim().split(/\s+/).filter(Boolean)
        const where: Prisma.EmployeeWhereInput = {
          workspace_id: workspaceId,
          AND: tokens.map((t) => ({
            OR: [
              { first_name: { contains: t, mode: 'insensitive' as const } },
              { last_name: { contains: t, mode: 'insensitive' as const } },
            ],
          })),
        }

        const employees = await prisma.employee.findMany({
          where,
          // ALLOWLIST select — never personnummer/email/phone/address/fortnox_raw.
          // Story 7.10: `id` is included so the typed-name path can feed
          // get_employee_salary (still salary/PII-free otherwise).
          select: {
            id: true,
            first_name: true,
            last_name: true,
            employment_form: true,
            employment_date: true,
            personel_type: true,
            full_time_equivalent: true,
            inactive: true,
            collective_agreement: { select: { id: true, name: true } },
          },
          orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
          take: MAX_MATCHES,
        })

        if (employees.length === 0) {
          return wrapToolError(
            'lookup_employee',
            `Ingen anställd matchade "${name}".`,
            'Kontrollera stavningen eller prova med enbart förnamn eller efternamn. Personen kanske inte finns i personalregistret.',
            startTime
          )
        }

        const results = employees.map((e) => ({
          id: e.id,
          name: `${e.first_name} ${e.last_name}`.trim(),
          employmentForm: employmentFormLabel(e.employment_form),
          employmentDate: formatEmploymentDate(e.employment_date),
          personelType: personelTypeLabel(e.personel_type),
          fullTimeEquivalent: formatFullTimeEquivalent(e.full_time_equivalent),
          status: employeeStatusLabel(e.inactive),
          collectiveAgreement: e.collective_agreement
            ? {
                id: e.collective_agreement.id,
                name: e.collective_agreement.name,
              }
            : null,
        }))

        return wrapToolResponse('lookup_employee', results, startTime)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'lookup_employee',
          `Uppslaget misslyckades: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}
