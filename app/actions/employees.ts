'use server'

/**
 * Story 7.2 (Epic 7): Server actions for employee org groups (EmployeeGroup)
 * and group membership moves.
 *
 * Rules enforced here:
 *  - Every mutation is wrapped in `withWorkspace(cb, 'employees:manage')` and
 *    every query filters/sets `workspace_id: ctx.workspaceId`.
 *  - `getEmployeeGroups` (read) is gated by `employees:view` only.
 *  - `EmployeeGroup.position` is an `Int` — reorder renumbers 0..n
 *    (NOT the law-list fractional-Float ranking).
 *  - Deleting a group leaves its employees ungrouped (FK is `onDelete: SetNull`);
 *    the action never touches the Employee model.
 *  - Every mutation ends with `revalidatePath('/personalregister')`
 *    (repo convention — cf. app/actions/files.ts → revalidatePath('/filer')).
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  Prisma,
  EmploymentForm,
  PersonelType,
  SalaryForm,
  type CollectiveAgreementStatus,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  withWorkspace,
  type WorkspaceContext,
} from '@/lib/auth/workspace-context'
import { encryptPersonnummer } from '@/lib/employees/personnummer'
import { normalizeSalary, encryptSalary } from '@/lib/employees/salary'
import { validatePersonnummer } from '@/lib/employees/personnummer-validation'
import { getEmployeeRow } from '@/lib/employees/employee-repository'
import {
  toEmployeeRow,
  type EmployeeRow,
} from '@/components/features/personalregister/employee-row'

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export interface EmployeeGroupSummary {
  id: string
  name: string
  position: number
  employeeCount: number
}

// ============================================================================
// Validation
// ============================================================================

const GroupNameSchema = z
  .string()
  .trim()
  .min(1, 'Gruppnamnet får inte vara tomt.')
  .max(100, 'Gruppnamnet får vara högst 100 tecken.')

const PERSONALREGISTER_PATH = '/personalregister'

const DUPLICATE_NAME_ERROR = 'En grupp med det namnet finns redan.'

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}

// ============================================================================
// Read
// ============================================================================

/**
 * List all employee groups in the workspace, ordered by position.
 * Gated by `employees:view` (read-only surface).
 */
export async function getEmployeeGroups(): Promise<
  ActionResult<EmployeeGroupSummary[]>
> {
  try {
    const groups = await withWorkspace(
      (ctx) =>
        prisma.employeeGroup.findMany({
          where: { workspace_id: ctx.workspaceId },
          // created_at tiebreaker keeps the order deterministic even if
          // positions were ever duplicated (QA DATA-001).
          orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
          select: {
            id: true,
            name: true,
            position: true,
            _count: { select: { employees: true } },
          },
        }),
      'employees:view'
    )

    return {
      success: true,
      data: groups.map((g) => ({
        id: g.id,
        name: g.name,
        position: g.position,
        employeeCount: g._count.employees,
      })),
    }
  } catch (error) {
    console.error('[getEmployeeGroups]', error)
    return { success: false, error: 'Kunde inte hämta grupper.' }
  }
}

// ============================================================================
// Mutations (all gated employees:manage)
// ============================================================================

/**
 * Create a new employee group at the end of the ordering.
 */
export async function createEmployeeGroup(
  name: string
): Promise<ActionResult<EmployeeGroupSummary>> {
  const parsed = GroupNameSchema.safeParse(name)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Ogiltigt gruppnamn.',
    }
  }

  try {
    const group = await withWorkspace(async (ctx) => {
      // Append at the end: position = current max + 1 (0 for the first group).
      const last = await prisma.employeeGroup.findFirst({
        where: { workspace_id: ctx.workspaceId },
        orderBy: { position: 'desc' },
        select: { position: true },
      })

      return prisma.employeeGroup.create({
        data: {
          workspace_id: ctx.workspaceId,
          name: parsed.data,
          position: last ? last.position + 1 : 0,
        },
      })
    }, 'employees:manage')

    revalidatePath(PERSONALREGISTER_PATH)
    return {
      success: true,
      data: {
        id: group.id,
        name: group.name,
        position: group.position,
        employeeCount: 0,
      },
    }
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return { success: false, error: DUPLICATE_NAME_ERROR }
    }
    console.error('[createEmployeeGroup]', error)
    return { success: false, error: 'Kunde inte skapa gruppen.' }
  }
}

/**
 * Rename an employee group (workspace-scoped).
 */
export async function renameEmployeeGroup(
  id: string,
  name: string
): Promise<ActionResult> {
  const parsed = GroupNameSchema.safeParse(name)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Ogiltigt gruppnamn.',
    }
  }

  try {
    const updated = await withWorkspace(
      (ctx) =>
        prisma.employeeGroup.updateMany({
          where: { id, workspace_id: ctx.workspaceId },
          data: { name: parsed.data },
        }),
      'employees:manage'
    )

    if (updated.count === 0) {
      return { success: false, error: 'Gruppen kunde inte hittas.' }
    }

    revalidatePath(PERSONALREGISTER_PATH)
    return { success: true }
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return { success: false, error: DUPLICATE_NAME_ERROR }
    }
    console.error('[renameEmployeeGroup]', error)
    return { success: false, error: 'Kunde inte byta namn på gruppen.' }
  }
}

/**
 * Reorder employee groups: rewrites `position` 0..n (contiguous — the
 * `EmployeeGroup.position` column is an Int).
 *
 * Hardened per QA DATA-001: the incoming ids are intersected with the
 * workspace's actual groups first, so foreign/unknown ids never consume an
 * index (no position gaps), and any workspace groups omitted from the list
 * are appended after the requested ones in their current (stable) order —
 * positions therefore stay gap-free and unique regardless of input.
 */
export async function reorderEmployeeGroups(
  ids: string[]
): Promise<ActionResult> {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return { success: false, error: 'Ogiltig ordning.' }
  }

  try {
    await withWorkspace(async (ctx) => {
      const existing = await prisma.employeeGroup.findMany({
        where: { workspace_id: ctx.workspaceId },
        orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
        select: { id: true },
      })
      const existingIds = new Set(existing.map((g) => g.id))

      // Intersection in the caller's order (deduped), foreign ids dropped…
      const ordered: string[] = []
      const seen = new Set<string>()
      for (const id of ids) {
        if (existingIds.has(id) && !seen.has(id)) {
          ordered.push(id)
          seen.add(id)
        }
      }
      // …then any workspace groups the caller omitted, in stable current order.
      for (const group of existing) {
        if (!seen.has(group.id)) ordered.push(group.id)
      }

      return prisma.$transaction(
        ordered.map((id, index) =>
          prisma.employeeGroup.updateMany({
            where: { id, workspace_id: ctx.workspaceId },
            data: { position: index },
          })
        )
      )
    }, 'employees:manage')

    revalidatePath(PERSONALREGISTER_PATH)
    return { success: true }
  } catch (error) {
    console.error('[reorderEmployeeGroups]', error)
    return { success: false, error: 'Kunde inte spara ordningen.' }
  }
}

/**
 * Delete an employee group. Employees in the group become ungrouped via the
 * FK's `onDelete: SetNull` — this action never touches the Employee model.
 */
export async function deleteEmployeeGroup(id: string): Promise<ActionResult> {
  try {
    const deleted = await withWorkspace(
      (ctx) =>
        prisma.employeeGroup.deleteMany({
          where: { id, workspace_id: ctx.workspaceId },
        }),
      'employees:manage'
    )

    if (deleted.count === 0) {
      return { success: false, error: 'Gruppen kunde inte hittas.' }
    }

    revalidatePath(PERSONALREGISTER_PATH)
    return { success: true }
  } catch (error) {
    console.error('[deleteEmployeeGroup]', error)
    return { success: false, error: 'Kunde inte ta bort gruppen.' }
  }
}

// ============================================================================
// Story 7.3: Employee create/update + kollektivavtal read
// ============================================================================

/**
 * Kollektivavtal option for the Personalkort select (Story 7.3 — first reader
 * of the 7.1 CollectiveAgreement model; upload/ingestion is Story 7.5).
 */
export interface CollectiveAgreementOption {
  id: string
  name: string
  personel_type: PersonelType | null
  status: CollectiveAgreementStatus
}

/**
 * Employee create/update input schema (module-private — a 'use server' file
 * may only export async functions; the Personalkort form has its own
 * co-located mirror of this schema).
 *
 * Lenient-required by design: only förnamn + efternamn block save. All other
 * fields optional — missing LAS-critical data becomes "Ej komplett" in
 * Story 7.4, not a save blocker. Personnummer is validated (format + Luhn)
 * only when present.
 */
const optionalString = (max: number) =>
  z.string().trim().max(max, `Max ${max} tecken.`).nullish()

const optionalIsoDate = z
  .string()
  .trim()
  .nullish()
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Ogiltigt datum.')

const EmployeeInputSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, 'Förnamn krävs.')
    .max(255, 'Max 255 tecken.'),
  last_name: z
    .string()
    .trim()
    .min(1, 'Efternamn krävs.')
    .max(255, 'Max 255 tecken.'),
  /**
   * Three-state contract (QA DATA-001):
   *  - key ABSENT / `undefined` → leave the stored column untouched on update
   *    (the update write omits the field entirely — an unreadable/masked
   *    ciphertext is never silently replaced),
   *  - `''` or `null`          → explicit clear → stored as null,
   *  - value                   → validate (format + Luhn) + encrypt + set.
   * Create mode has no stored value to preserve: absent/empty both → null.
   */
  personnummer: z
    .string()
    .trim()
    .max(13, 'Ogiltigt format — ange ÅÅMMDD-XXXX')
    .nullish()
    .superRefine((value, ctx) => {
      const result = validatePersonnummer(value)
      if (!result.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.error ?? 'Ogiltigt personnummer',
        })
      }
    }),
  email: optionalString(255),
  phone1: optionalString(64),
  phone2: optionalString(64),
  address1: optionalString(255),
  address2: optionalString(255),
  post_code: optionalString(16),
  city: optionalString(128),
  country: optionalString(56),
  job_title: z.string().trim().max(30, 'Max 30 tecken.').nullish(),
  employee_id_ref: z.string().trim().max(15, 'Max 15 tecken.').nullish(),
  employment_date: optionalIsoDate,
  employed_to: optionalIsoDate,
  employment_form: z.nativeEnum(EmploymentForm).nullish(),
  personel_type: z.nativeEnum(PersonelType).nullish(),
  salary_form: z.nativeEnum(SalaryForm).nullish(),
  /**
   * Story 7.10: salary amounts (encrypted at rest, manage-only). Same
   * three-state contract as personnummer — absent/undefined = keep the stored
   * ciphertext on update, ''/null = clear → null, value = normalize + encrypt +
   * set. Kept as raw numeric strings here (comma or dot); `normalizeSalary`
   * canonicalizes + rejects negative/NaN at write time.
   */
  monthly_salary: z.string().trim().nullish(),
  hourly_pay: z.string().trim().nullish(),
  full_time_equivalent: z
    .number()
    .min(0, 'Sysselsättningsgrad måste vara mellan 0 och 1.')
    .max(1, 'Sysselsättningsgrad måste vara mellan 0 och 1.')
    .nullish(),
  average_weekly_hours: z
    .number()
    .min(0, 'Veckoarbetstid kan inte vara negativ.')
    .nullish(),
  vacation_days_paid: z
    .number()
    .min(0, 'Semesterdagar kan inte vara negativa.')
    .nullish(),
  inactive: z.boolean().nullish(),
  manager_id: z.string().nullish(),
  collective_agreement_id: z.string().nullish(),
  group_id: z.string().nullish(),
})

export type EmployeeInput = z.infer<typeof EmployeeInputSchema>

const EMPLOYEE_ENCRYPTION_ERROR =
  'Personnummer kunde inte sparas säkert just nu. Försök igen eller kontakta support.'

const EMPLOYEE_SALARY_INVALID_ERROR =
  'Ange ett giltigt lönebelopp (0 eller mer).'

const EMPLOYEE_SALARY_ENCRYPTION_ERROR =
  'Lönen kunde inte sparas säkert just nu. Försök igen eller kontakta support.'

function firstIssueMessage(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

function isoToDate(value: string | null | undefined): Date | null {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : new Date(`${trimmed}T00:00:00.000Z`)
}

/**
 * Shared field mapping (everything except personnummer, which is encrypted
 * separately — plaintext is never part of any persisted/logged object).
 */
function toEmployeeData(data: EmployeeInput) {
  return {
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim(),
    email: trimOrNull(data.email),
    phone1: trimOrNull(data.phone1),
    phone2: trimOrNull(data.phone2),
    address1: trimOrNull(data.address1),
    address2: trimOrNull(data.address2),
    post_code: trimOrNull(data.post_code),
    city: trimOrNull(data.city),
    country: trimOrNull(data.country) ?? 'SE',
    job_title: trimOrNull(data.job_title),
    employee_id_ref: trimOrNull(data.employee_id_ref),
    employment_date: isoToDate(data.employment_date),
    employed_to: isoToDate(data.employed_to),
    employment_form: data.employment_form ?? null,
    personel_type: data.personel_type ?? null,
    salary_form: data.salary_form ?? null,
    full_time_equivalent: data.full_time_equivalent ?? null,
    average_weekly_hours: data.average_weekly_hours ?? null,
    vacation_days_paid: data.vacation_days_paid ?? null,
    inactive: data.inactive ?? false,
    manager_id: data.manager_id ?? null,
    collective_agreement_id: data.collective_agreement_id ?? null,
    group_id: data.group_id ?? null,
  }
}

/**
 * Verify that referenced manager/group/kollektivavtal all belong to the
 * caller's workspace (a crafted request must not link a foreign record), and
 * that an employee is never their own manager. Returns a Swedish error string
 * or null when everything checks out.
 */
async function validateEmployeeRelations(
  ctx: WorkspaceContext,
  data: EmployeeInput,
  employeeId?: string
): Promise<string | null> {
  if (data.manager_id) {
    if (employeeId && data.manager_id === employeeId) {
      return 'En anställd kan inte vara sin egen chef.'
    }
    const manager = await prisma.employee.findFirst({
      where: { id: data.manager_id, workspace_id: ctx.workspaceId },
      select: { id: true },
    })
    if (!manager) return 'Chefen kunde inte hittas.'
  }

  if (data.group_id) {
    const group = await prisma.employeeGroup.findFirst({
      where: { id: data.group_id, workspace_id: ctx.workspaceId },
      select: { id: true },
    })
    if (!group) return 'Gruppen kunde inte hittas.'
  }

  if (data.collective_agreement_id) {
    const agreement = await prisma.collectiveAgreement.findFirst({
      where: {
        id: data.collective_agreement_id,
        workspace_id: ctx.workspaceId,
      },
      select: { id: true },
    })
    if (!agreement) return 'Kollektivavtalet kunde inte hittas.'
  }

  return null
}

/**
 * Encrypt the personnummer for storage (write contract from Story 7.1).
 * Empty string → null. Fail-closed: a missing/invalid ENCRYPTION_KEY becomes
 * a friendly action error — plaintext is NEVER persisted or logged.
 */
function encryptPersonnummerOrError(
  value: string | null | undefined
): { ok: true; ciphertext: string | null } | { ok: false; error: string } {
  const trimmed = value?.trim() ?? ''
  if (trimmed === '') return { ok: true, ciphertext: null }
  try {
    return { ok: true, ciphertext: encryptPersonnummer(trimmed) }
  } catch {
    // Deliberately no error/value logging here — fail closed and quiet.
    return { ok: false, error: EMPLOYEE_ENCRYPTION_ERROR }
  }
}

/**
 * Story 7.10: encrypt a salary amount for storage (mirrors
 * `encryptPersonnummerOrError`). `''`/absent → null (clear). A value is
 * NORMALIZED first (`normalizeSalary` — comma→dot, toFixed(2), the single
 * canonicalization point) which also rejects negative/NaN with a friendly
 * error; the canonical string is then encrypted. Fail-closed: a missing/invalid
 * ENCRYPTION_KEY becomes a friendly error — plaintext is NEVER persisted or
 * logged.
 */
function encryptSalaryOrError(
  value: string | null | undefined
): { ok: true; ciphertext: string | null } | { ok: false; error: string } {
  const trimmed = value?.trim() ?? ''
  if (trimmed === '') return { ok: true, ciphertext: null }
  const normalized = normalizeSalary(trimmed)
  if (normalized === null) {
    return { ok: false, error: EMPLOYEE_SALARY_INVALID_ERROR }
  }
  try {
    return { ok: true, ciphertext: encryptSalary(normalized) }
  } catch {
    // Deliberately no error/value logging here — fail closed and quiet.
    return { ok: false, error: EMPLOYEE_SALARY_ENCRYPTION_ERROR }
  }
}

/**
 * List the workspace's kollektivavtal for the Personalkort select.
 * Gated by `employees:view` (read-only surface).
 */
export async function getCollectiveAgreements(): Promise<
  ActionResult<CollectiveAgreementOption[]>
> {
  try {
    const agreements = await withWorkspace(
      (ctx) =>
        prisma.collectiveAgreement.findMany({
          where: { workspace_id: ctx.workspaceId },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            personel_type: true,
            status: true,
          },
        }),
      'employees:view'
    )

    return { success: true, data: agreements }
  } catch (error) {
    console.error('[getCollectiveAgreements]', error)
    return { success: false, error: 'Kunde inte hämta kollektivavtal.' }
  }
}

/**
 * Story 7.7: minimal, PII-safe employee list for the chat employee pill.
 * Gated by `employees:view`. ALLOWLIST select only — no personnummer (any
 * form), no email/phone/address, no fortnox_raw. Decimal/Date fields are
 * serialized at the boundary (number / ISO date string) for the client.
 */
export interface ChatContextEmployee {
  id: string
  first_name: string
  last_name: string
  personel_type: PersonelType | null
  employment_form: EmploymentForm | null
  /** YYYY-MM-DD, or null when not set. */
  employment_date: string | null
  /** 0–1 (1.0 = heltid), or null when not set. */
  full_time_equivalent: number | null
  inactive: boolean
  collective_agreement: { id: string; name: string } | null
}

export async function getEmployeesForChatContext(): Promise<
  ActionResult<ChatContextEmployee[]>
> {
  try {
    const employees = await withWorkspace(
      (ctx) =>
        prisma.employee.findMany({
          where: { workspace_id: ctx.workspaceId },
          orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
          select: {
            id: true,
            first_name: true,
            last_name: true,
            personel_type: true,
            employment_form: true,
            employment_date: true,
            full_time_equivalent: true,
            inactive: true,
            collective_agreement: { select: { id: true, name: true } },
          },
        }),
      'employees:view'
    )

    return {
      success: true,
      data: employees.map((e) => ({
        ...e,
        employment_date: e.employment_date
          ? e.employment_date.toISOString().slice(0, 10)
          : null,
        // Decimal → number at the boundary (0 is a real value, only null is missing).
        full_time_equivalent:
          e.full_time_equivalent != null
            ? e.full_time_equivalent.toNumber()
            : null,
      })),
    }
  } catch (error) {
    console.error('[getEmployeesForChatContext]', error)
    return { success: false, error: 'Kunde inte hämta anställda.' }
  }
}

/**
 * Create an employee. Personnummer (when present) is encrypted via
 * `encryptPersonnummer` before store; `created_by` comes from ctx. Returns the
 * sanitized serialized row (never the raw Prisma record — no ciphertext, no
 * fortnox_raw, Decimals converted for the RSC/client boundary).
 */
export async function createEmployee(
  input: EmployeeInput
): Promise<ActionResult<EmployeeRow>> {
  const parsed = EmployeeInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: firstIssueMessage(parsed.error, 'Ogiltiga uppgifter.'),
    }
  }

  try {
    const result = await withWorkspace(async (ctx) => {
      const relationError = await validateEmployeeRelations(ctx, parsed.data)
      if (relationError) return { ok: false as const, error: relationError }

      const encrypted = encryptPersonnummerOrError(parsed.data.personnummer)
      if (!encrypted.ok) return { ok: false as const, error: encrypted.error }

      // Story 7.10: salary is encrypted the same way (create has no stored
      // value to preserve — absent/empty both → null ciphertext).
      const monthly = encryptSalaryOrError(parsed.data.monthly_salary)
      if (!monthly.ok) return { ok: false as const, error: monthly.error }
      const hourly = encryptSalaryOrError(parsed.data.hourly_pay)
      if (!hourly.ok) return { ok: false as const, error: hourly.error }

      const created = await prisma.employee.create({
        data: {
          workspace_id: ctx.workspaceId,
          created_by: ctx.userId,
          ...toEmployeeData(parsed.data),
          personnummer: encrypted.ciphertext,
          monthly_salary: monthly.ciphertext,
          hourly_pay: hourly.ciphertext,
        },
        select: { id: true },
      })

      const row = await getEmployeeRow(ctx, created.id)
      if (!row) {
        return {
          ok: false as const,
          error: 'Anställd kunde inte läsas efter skapandet.',
        }
      }
      return { ok: true as const, row: toEmployeeRow(row) }
    }, 'employees:manage')

    if (!result.ok) return { success: false, error: result.error }

    revalidatePath(PERSONALREGISTER_PATH)
    return { success: true, data: result.row }
  } catch (error) {
    console.error('[createEmployee]', error)
    return { success: false, error: 'Kunde inte skapa den anställda.' }
  }
}

/**
 * Update an employee. Verifies the row belongs to the caller's workspace
 * BEFORE writing (findFirst-then-update); validates that manager/group/
 * kollektivavtal references stay inside the workspace; encrypts personnummer
 * on write. Returns the sanitized serialized row.
 *
 * Personnummer is three-state (QA DATA-001): when the input OMITS the key
 * (`undefined`) the stored column is left untouched — the Prisma write never
 * includes the field, so a masked/undecryptable ciphertext (e.g. during a
 * transient ENCRYPTION_KEY misconfiguration) survives routine edits. `''`/
 * `null` is an explicit clear (→ null); a value is validated + encrypted.
 */
export async function updateEmployee(
  id: string,
  input: EmployeeInput
): Promise<ActionResult<EmployeeRow>> {
  const parsed = EmployeeInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: firstIssueMessage(parsed.error, 'Ogiltiga uppgifter.'),
    }
  }

  try {
    const result = await withWorkspace(async (ctx) => {
      // Workspace ownership check BEFORE any write (cross-workspace guard).
      const existing = await prisma.employee.findFirst({
        where: { id, workspace_id: ctx.workspaceId },
        select: { id: true },
      })
      if (!existing) {
        return { ok: false as const, error: 'Anställd kunde inte hittas.' }
      }

      const relationError = await validateEmployeeRelations(
        ctx,
        parsed.data,
        id
      )
      if (relationError) return { ok: false as const, error: relationError }

      // Three-state personnummer (QA DATA-001): an absent key means "keep" —
      // the column is OMITTED from the write so the stored ciphertext is
      // never touched. ''/null clears; a value is encrypted and set.
      let personnummerWrite: { personnummer: string | null } | undefined
      if (parsed.data.personnummer !== undefined) {
        const encrypted = encryptPersonnummerOrError(parsed.data.personnummer)
        if (!encrypted.ok) {
          return { ok: false as const, error: encrypted.error }
        }
        personnummerWrite = { personnummer: encrypted.ciphertext }
      }

      // Story 7.10: salary is three-state too — an absent key (e.g. a masked
      // prefill submitted empty by a view/degraded-manage path) OMITS the
      // column so the stored ciphertext survives; ''/null clears; a value is
      // normalized + encrypted.
      let monthlySalaryWrite: { monthly_salary: string | null } | undefined
      if (parsed.data.monthly_salary !== undefined) {
        const monthly = encryptSalaryOrError(parsed.data.monthly_salary)
        if (!monthly.ok) return { ok: false as const, error: monthly.error }
        monthlySalaryWrite = { monthly_salary: monthly.ciphertext }
      }
      let hourlyPayWrite: { hourly_pay: string | null } | undefined
      if (parsed.data.hourly_pay !== undefined) {
        const hourly = encryptSalaryOrError(parsed.data.hourly_pay)
        if (!hourly.ok) return { ok: false as const, error: hourly.error }
        hourlyPayWrite = { hourly_pay: hourly.ciphertext }
      }

      // updateMany keeps the workspace filter in the write itself (defense in
      // depth against TOCTOU) — `updated_at` is maintained by @updatedAt.
      await prisma.employee.updateMany({
        where: { id, workspace_id: ctx.workspaceId },
        data: {
          ...toEmployeeData(parsed.data),
          ...personnummerWrite,
          ...monthlySalaryWrite,
          ...hourlyPayWrite,
        },
      })

      const row = await getEmployeeRow(ctx, id)
      if (!row) {
        return {
          ok: false as const,
          error: 'Anställd kunde inte läsas efter uppdateringen.',
        }
      }
      return { ok: true as const, row: toEmployeeRow(row) }
    }, 'employees:manage')

    if (!result.ok) return { success: false, error: result.error }

    revalidatePath(PERSONALREGISTER_PATH)
    return { success: true, data: result.row }
  } catch (error) {
    console.error('[updateEmployee]', error)
    return { success: false, error: 'Kunde inte spara ändringarna.' }
  }
}

/**
 * Move an employee to a group (or ungroup with `groupId: null`). Validates
 * that the target group belongs to the caller's workspace before assigning.
 */
export async function moveEmployeeToGroup(
  employeeId: string,
  groupId: string | null
): Promise<ActionResult> {
  try {
    const result = await withWorkspace(async (ctx) => {
      if (groupId !== null) {
        const group = await prisma.employeeGroup.findFirst({
          where: { id: groupId, workspace_id: ctx.workspaceId },
          select: { id: true },
        })
        if (!group) {
          return { ok: false as const, error: 'Gruppen kunde inte hittas.' }
        }
      }

      const updated = await prisma.employee.updateMany({
        where: { id: employeeId, workspace_id: ctx.workspaceId },
        data: { group_id: groupId },
      })

      if (updated.count === 0) {
        return { ok: false as const, error: 'Anställd kunde inte hittas.' }
      }

      return { ok: true as const }
    }, 'employees:manage')

    if (!result.ok) {
      return { success: false, error: result.error }
    }

    revalidatePath(PERSONALREGISTER_PATH)
    return { success: true }
  } catch (error) {
    console.error('[moveEmployeeToGroup]', error)
    return { success: false, error: 'Kunde inte flytta den anställda.' }
  }
}

/**
 * Permanently delete an employee (GDPR right-to-erasure). Hard delete — the
 * record holds encrypted PII (personnummer, lön) and the reversible "hide"
 * case is already covered by the `inactive` flag / Inaktiva tab.
 *
 * FK-safe: no other model references Employee, and the manager self-relation
 * is `onDelete: SetNull`, so any reports' `manager_id` is nulled by the DB.
 * The workspace filter lives in the `deleteMany` write itself (defense in
 * depth against TOCTOU); `count === 0` means the id was foreign or stale.
 */
export async function deleteEmployee(id: string): Promise<ActionResult> {
  try {
    const deleted = await withWorkspace(
      (ctx) =>
        prisma.employee.deleteMany({
          where: { id, workspace_id: ctx.workspaceId },
        }),
      'employees:manage'
    )

    if (deleted.count === 0) {
      return { success: false, error: 'Anställd kunde inte hittas.' }
    }

    revalidatePath(PERSONALREGISTER_PATH)
    return { success: true }
  } catch (error) {
    console.error('[deleteEmployee]', error)
    return { success: false, error: 'Kunde inte ta bort den anställda.' }
  }
}
