/**
 * Story 7.1 (Epic 7): Thin, workspace-scoped employee read helper.
 *
 * Scope for 7.1 is deliberately minimal — read-only list/get with workspace
 * isolation and role-gated personnummer handling. Full CRUD server actions land
 * in Story 7.3; the write-side encryption contract is
 * `encryptPersonnummer` (lib/employees/personnummer.ts).
 *
 * Rules enforced here:
 *  - Every query filters `workspace_id: ctx.workspaceId` (workspace isolation).
 *  - personnummer is decrypted ONLY for `employees:manage`; otherwise masked.
 *  - Public entry points go through `withWorkspace(cb, 'employees:view')`.
 */

import { prisma } from '@/lib/prisma'
import type { Employee } from '@prisma/client'
import {
  withWorkspace,
  type WorkspaceContext,
} from '@/lib/auth/workspace-context'
import { decryptPersonnummer, maskPersonnummer } from './personnummer'
import { decryptSalary, maskSalary } from './salary'

/**
 * Employee as returned to callers: the stored `personnummer` ciphertext is
 * replaced by either the decrypted value (authorized) or a fixed mask, with a
 * `personnummer_masked` flag so the UI knows which it received.
 *
 * Story 7.10: the `monthly_salary` / `hourly_pay` ciphertext columns are
 * treated the SAME way but STRICTER — decrypted only for `employees:manage`,
 * masked/nulled for every other role. A single `salary_masked` flag covers
 * both amounts. Column visibility in the register is display-only: this repo
 * gate is the real access control, applied BEFORE the row serializes to the
 * client, so a view-only browser never receives salary ciphertext or plaintext.
 *
 * `fortnox_raw` is deliberately dropped — the raw Fortnox payload snapshot
 * contains the plaintext PersonalIdentityNumber, so it must never travel out of
 * this layer alongside a masked personnummer (it would defeat the masking). It
 * stays server-side only.
 */
export type EmployeeView = Omit<
  Employee,
  'personnummer' | 'fortnox_raw' | 'monthly_salary' | 'hourly_pay'
> & {
  personnummer: string | null
  personnummer_masked: boolean
  monthly_salary: string | null
  hourly_pay: string | null
  salary_masked: boolean
}

/**
 * Decrypt a stored salary ciphertext for a manage role, degrading a single
 * corrupt/undecryptable value to the mask instead of throwing out of the whole
 * list (mirrors the personnummer contract). For non-manage roles the ciphertext
 * is masked outright — the plaintext is never touched.
 */
function toSalaryView(
  cipher: string | null,
  canManage: boolean
): { value: string | null; masked: boolean } {
  if (!cipher) return { value: null, masked: false }
  if (!canManage) return { value: maskSalary(), masked: true }
  try {
    return { value: decryptSalary(cipher), masked: false }
  } catch {
    return { value: maskSalary(), masked: true }
  }
}

function toView(employee: Employee, canManage: boolean): EmployeeView {
  // Strip the ciphertext personnummer/salary columns and fortnox_raw (plaintext
  // PII) from the outgoing shape; re-add safe values below.
  const { personnummer, fortnox_raw, monthly_salary, hourly_pay, ...rest } =
    employee
  void fortnox_raw // intentionally not returned to callers

  let value: string | null = null
  let masked = false

  if (personnummer) {
    if (canManage) {
      try {
        value = decryptPersonnummer(personnummer)
      } catch {
        // A single unreadable ciphertext (corrupt value, or a rotated/missing
        // key) must not fail the whole list — degrade this row to the mask
        // instead of throwing out of listEmployees.
        value = maskPersonnummer(personnummer)
        masked = true
      }
    } else {
      value = maskPersonnummer(personnummer)
      masked = true
    }
  }

  // Story 7.10: manage-only salary. A masked/undecryptable amount on EITHER
  // column raises the shared `salary_masked` flag (the form uses it to keep the
  // stored ciphertext on an empty submit).
  const monthly = toSalaryView(monthly_salary, canManage)
  const hourly = toSalaryView(hourly_pay, canManage)

  return {
    ...rest,
    personnummer: value,
    personnummer_masked: masked,
    monthly_salary: monthly.value,
    hourly_pay: hourly.value,
    salary_masked: monthly.masked || hourly.masked,
  }
}

/**
 * List all employees in the caller's workspace. Personnummer is decrypted for
 * `employees:manage`, masked otherwise. Always workspace-scoped.
 */
export async function listEmployees(
  ctx: WorkspaceContext
): Promise<EmployeeView[]> {
  const canManage = ctx.hasPermission('employees:manage')

  const employees = await prisma.employee.findMany({
    where: { workspace_id: ctx.workspaceId },
    orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
  })

  return employees.map((e) => toView(e, canManage))
}

/**
 * Fetch a single employee by id, scoped to the caller's workspace (returns null
 * if it belongs to another workspace or does not exist).
 */
export async function getEmployee(
  ctx: WorkspaceContext,
  id: string
): Promise<EmployeeView | null> {
  const canManage = ctx.hasPermission('employees:manage')

  const employee = await prisma.employee.findFirst({
    where: { id, workspace_id: ctx.workspaceId },
  })

  return employee ? toView(employee, canManage) : null
}

/**
 * Story 7.2: employee list row for the Personalregister table — the plain
 * `EmployeeView` plus the display names of the org group and kollektivavtal
 * relations (id + name only; nothing sensitive lives on either relation).
 */
export type EmployeeListRow = EmployeeView & {
  group: { id: string; name: string } | null
  collective_agreement: { id: string; name: string } | null
}

/**
 * Story 7.2: list employees with relation names for the register table.
 * Same personnummer decrypt/mask + `fortnox_raw` stripping as `listEmployees`
 * (delegates to `toView`); same workspace scoping.
 */
export async function listEmployeeRows(
  ctx: WorkspaceContext
): Promise<EmployeeListRow[]> {
  const canManage = ctx.hasPermission('employees:manage')

  const employees = await prisma.employee.findMany({
    where: { workspace_id: ctx.workspaceId },
    include: {
      group: { select: { id: true, name: true } },
      collective_agreement: { select: { id: true, name: true } },
    },
    orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
  })

  return employees.map((row) => {
    // Split the relations off before toView so the sanitization contract
    // (drop ciphertext personnummer + fortnox_raw) applies to the base record.
    const { group, collective_agreement, ...employee } = row
    return {
      ...toView(employee, canManage),
      group,
      collective_agreement,
    }
  })
}

/**
 * Story 7.3: fetch a single employee as a list row (with relation names),
 * scoped to the caller's workspace. Same sanitization contract as
 * `listEmployeeRows` — ciphertext personnummer replaced (decrypt/mask via
 * `toView`), `fortnox_raw` stripped. Returns null for foreign/missing ids.
 *
 * Used by the 7.3 create/update server actions to return a sanitized row —
 * never the raw Prisma record.
 */
export async function getEmployeeRow(
  ctx: WorkspaceContext,
  id: string
): Promise<EmployeeListRow | null> {
  const canManage = ctx.hasPermission('employees:manage')

  const row = await prisma.employee.findFirst({
    where: { id, workspace_id: ctx.workspaceId },
    include: {
      group: { select: { id: true, name: true } },
      collective_agreement: { select: { id: true, name: true } },
    },
  })

  if (!row) return null

  const { group, collective_agreement, ...employee } = row
  return {
    ...toView(employee, canManage),
    group,
    collective_agreement,
  }
}

/**
 * Public entry point: list employees for the current workspace, gated by
 * `employees:view`.
 */
export function getWorkspaceEmployees(): Promise<EmployeeView[]> {
  return withWorkspace((ctx) => listEmployees(ctx), 'employees:view')
}

/**
 * Story 7.2 public entry point: list employee rows (with relation names) for
 * the current workspace, gated by `employees:view`.
 */
export function getWorkspaceEmployeeRows(): Promise<EmployeeListRow[]> {
  return withWorkspace((ctx) => listEmployeeRows(ctx), 'employees:view')
}

/**
 * Public entry point: get one employee for the current workspace, gated by
 * `employees:view`.
 */
export function getWorkspaceEmployee(id: string): Promise<EmployeeView | null> {
  return withWorkspace((ctx) => getEmployee(ctx, id), 'employees:view')
}
