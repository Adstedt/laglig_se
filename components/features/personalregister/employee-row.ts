/**
 * Story 7.2: Client-serializable employee row.
 *
 * `EmployeeListRow` (repository) carries Prisma `Decimal` instances
 * (full_time_equivalent, average_weekly_hours, vacation_days_paid), which
 * cannot cross the RSC → client component boundary ("only plain objects can
 * be passed to Client Components"). The server page converts them to plain
 * numbers with `toEmployeeRow` before handing rows to the client island.
 */

import type { EmployeeListRow } from '@/lib/employees/employee-repository'

export type EmployeeRow = Omit<
  EmployeeListRow,
  'full_time_equivalent' | 'average_weekly_hours' | 'vacation_days_paid'
> & {
  full_time_equivalent: number | null
  average_weekly_hours: number | null
  vacation_days_paid: number | null
}

export function toEmployeeRow(row: EmployeeListRow): EmployeeRow {
  return {
    ...row,
    full_time_equivalent:
      row.full_time_equivalent === null
        ? null
        : Number(row.full_time_equivalent),
    average_weekly_hours:
      row.average_weekly_hours === null
        ? null
        : Number(row.average_weekly_hours),
    vacation_days_paid:
      row.vacation_days_paid === null ? null : Number(row.vacation_days_paid),
  }
}
