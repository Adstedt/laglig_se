/** Story 21.4 — /laglistor/kontroller/skapa wizard route. */

import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getDocumentLists,
  getWorkspaceMembers,
} from '@/app/actions/document-list'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { hasPermission } from '@/lib/auth/permissions'
import { CycleCreationWizard } from '@/components/features/compliance-audit/cycle-creation-wizard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Skapa kontroll | Laglig',
  description: 'Skapa en ny efterlevnadskontroll.',
}

export default async function CreateCyclePage() {
  const ctx = await getWorkspaceContext()
  if (!hasPermission(ctx.role, 'tasks:edit')) {
    redirect('/laglistor')
  }

  const [listsResult, membersResult] = await Promise.all([
    getDocumentLists(),
    getWorkspaceMembers(),
  ])

  const lawLists = listsResult.success ? (listsResult.data ?? []) : []
  const members = membersResult.success ? (membersResult.data ?? []) : []

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-safiro text-3xl font-medium tracking-tight">
          Skapa kontroll
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Välj omfattning och starta en ny efterlevnadskontroll.
        </p>
      </div>

      <CycleCreationWizard lawLists={lawLists} members={members} />
    </div>
  )
}
