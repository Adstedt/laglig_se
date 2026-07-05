/**
 * Story 7.2: Personalregister — employee list view.
 * Route gated by `employees:view` (OWNER + HR_MANAGER only); mirrors the
 * Laglistor page structure (PageHeader + client content island).
 *
 * Story 7.4: the `PageHeader` moved INTO the client island so its
 * "Kompletta"-stat derives from the island's live (unfiltered) row state and
 * updates optimistically after Personalkort saves — the server page only
 * supplies the primaryAction node and the workspace kollektivavtal flag.
 */

import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PersonalregisterPrimaryAction } from '@/components/features/personalregister/personalregister-primary-action'
import { PersonalregisterContent } from '@/components/features/personalregister/personalregister-content'
import { toEmployeeRow } from '@/components/features/personalregister/employee-row'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { hasPermission } from '@/lib/auth/permissions'
import { listEmployeeRows } from '@/lib/employees/employee-repository'
import { getEmployeeGroups } from '@/app/actions/employees'
import { getCompanyProfile } from '@/app/actions/company-profile'

// Force dynamic rendering since this page requires authentication
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Personalregister | Laglig',
  description: 'Se och hantera alla anställda på ett ställe.',
}

export default async function PersonalregisterPage() {
  const ctx = await getWorkspaceContext()

  // Permission gate BEFORE any employee fetch (getWorkspaceEmployeeRows would
  // throw WorkspaceAccessError for unauthorized roles — don't rely on it).
  if (!hasPermission(ctx.role, 'employees:view')) {
    redirect('/dashboard')
  }

  const canManage = hasPermission(ctx.role, 'employees:manage')

  const [rawRows, groupsResult, companyProfile] = await Promise.all([
    listEmployeeRows(ctx),
    getEmployeeGroups(),
    // Story 7.4: workspace kollektivavtal flag for the completeness rule.
    // Missing/failed profile → no kollektivavtal requirement (false).
    getCompanyProfile().catch((error: unknown) => {
      console.error('[personalregister] company profile fetch failed', error)
      return null
    }),
  ])

  // Prisma Decimal fields cannot cross the RSC → client boundary — serialize.
  const rows = rawRows.map(toEmployeeRow)

  const workspaceHasCollectiveAgreement =
    companyProfile?.has_collective_agreement ?? false

  // A failed groups fetch must not be silent (QA REL-001): log it and let the
  // island render a non-blocking notice while still showing ungrouped rows.
  const groupsLoadFailed = !groupsResult.success
  if (groupsLoadFailed) {
    console.error(
      '[personalregister] groups fetch failed',
      groupsResult.error ?? 'unknown error'
    )
  }
  const groups = groupsResult.success ? (groupsResult.data ?? []) : []

  return (
    <PersonalregisterContent
      initialRows={rows}
      groups={groups}
      canManage={canManage}
      groupsLoadFailed={groupsLoadFailed}
      workspaceHasCollectiveAgreement={workspaceHasCollectiveAgreement}
      headerPrimaryAction={
        <PersonalregisterPrimaryAction canManage={canManage} />
      }
    />
  )
}
