/**
 * get_employee_salary tool — decrypted salary for ONE employee, for the AI
 * löne-compliance flow. Story 7.10 (AC 5).
 *
 * SECURITY (trap #1): this tool is registered ONLY when the session role holds
 * `employees:manage` (stricter than lookup_employee's `employees:view` gate) —
 * see the conditional delete in `tools/index.ts`. A view-only agent has NO
 * tool at all, so it can never extract a salary the UI masks.
 *
 * It composes with `search_collective_agreements`: fetch the salary + assigned
 * agreement here, then search that avtal's minimilön clause and compare. Salary
 * NEVER enters `formatEmployeeContext` or `lookup_employee` — this manage-gated,
 * auditable tool call is the ONLY path a salary reaches the model.
 *
 * Employee precedence: an explicit `employeeId` param (e.g. from a
 * lookup_employee result) overrides the `biasEmployeeId` closure default (the
 * pill-selected employee, resolved server-side in the chat route). The
 * workspace clause sits underneath, so a foreign/hallucinated id finds nothing
 * — never another tenant's row.
 *
 * PII: returns ONLY the amounts, salary_form, personel_type and the assigned
 * agreement {id,name}. Never personnummer, email, phone or address.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { decryptSalary } from '@/lib/employees/salary'
import { wrapToolResponse, wrapToolError } from './utils'

const getEmployeeSalarySchema = z.object({
  employeeId: z
    .string()
    .optional()
    .describe(
      'ID för en specifik anställd (t.ex. från lookup_employee). Utelämnas det används den valda anställda i kontexten (personalpillen).'
    ),
})

type GetEmployeeSalaryInput = z.infer<typeof getEmployeeSalarySchema>

/** Decrypt a stored salary ciphertext, degrading a corrupt value to null. */
function safeDecryptSalary(cipher: string | null): string | null {
  if (!cipher) return null
  try {
    return decryptSalary(cipher)
  } catch {
    return null
  }
}

export function createGetEmployeeSalaryTool(
  workspaceId: string,
  biasEmployeeId?: string | undefined
) {
  return tool({
    description: `Hämta lön/ersättning för EN anställd i arbetsytan, för att bedöma löneavtal-compliance (betalar vi enligt kollektivavtalet?).
Använd detta verktyg när frågan rör en anställds lön, ersättning eller minimilön enligt avtal.

Ange \`employeeId\` för en specifik anställd (t.ex. ett id från lookup_employee). Utelämnas det används den anställda som är vald i kontexten (personalpillen).

Returnerar månadslön (\`monthly_salary\`) eller timlön (\`hourly_pay\`) beroende på löneform (\`salary_form\`: MAN=månadslön, TIM=timlön), personaltyp (\`personel_type\`) och tilldelat kollektivavtal ({id, name}).

Arbetsflöde: hämta lönen här, skicka sedan avtalets \`collective_agreement.id\` som \`agreementId\` till search_collective_agreements, sök upp minimilön/löneavtal för personaltypen och jämför. Lönen är beloppet i kronor (månadslön) respektive kronor/timme (timlön).`,
    inputSchema: zodSchema(getEmployeeSalarySchema),
    execute: async ({ employeeId }: GetEmployeeSalaryInput) => {
      const startTime = Date.now()

      // Precedence: model param > pill-closure bias (AC 5).
      const effectiveId = employeeId ?? biasEmployeeId
      if (!effectiveId) {
        return wrapToolError(
          'get_employee_salary',
          'Ingen anställd angavs.',
          'Ange ett employeeId (t.ex. från lookup_employee) eller be användaren välja en anställd i personalpillen.',
          startTime
        )
      }

      try {
        // Workspace-scoped + PII allowlist select — never personnummer/contact.
        const employee = await prisma.employee.findFirst({
          where: { id: effectiveId, workspace_id: workspaceId },
          select: {
            first_name: true,
            last_name: true,
            monthly_salary: true,
            hourly_pay: true,
            salary_form: true,
            personel_type: true,
            collective_agreement: { select: { id: true, name: true } },
          },
        })

        if (!employee) {
          return wrapToolError(
            'get_employee_salary',
            'Den anställda kunde inte hittas i arbetsytan.',
            'Kontrollera employeeId (använd lookup_employee för att slå upp rätt person) eller be användaren välja en anställd.',
            startTime
          )
        }

        const monthlySalary = safeDecryptSalary(employee.monthly_salary)
        const hourlyPay = safeDecryptSalary(employee.hourly_pay)

        return wrapToolResponse(
          'get_employee_salary',
          {
            name: `${employee.first_name} ${employee.last_name}`.trim(),
            monthly_salary: monthlySalary,
            hourly_pay: hourlyPay,
            salary_form: employee.salary_form,
            personel_type: employee.personel_type,
            collective_agreement: employee.collective_agreement
              ? {
                  id: employee.collective_agreement.id,
                  name: employee.collective_agreement.name,
                }
              : null,
          },
          startTime
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'get_employee_salary',
          `Hämtningen misslyckades: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}
