/**
 * Story 4.11: Document Lists Page
 * Story 8.1: Added "Ändringar" tab via LawListTabs wrapper
 * Main page for viewing and managing personalized document lists
 */

import { Suspense } from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
import {
  getDocumentLists,
  getOrCreateDefaultList,
} from '@/app/actions/document-list'
import { getPublishedTemplates } from '@/lib/db/queries/template-catalog'
import {
  getUnacknowledgedChanges,
  getUnacknowledgedChangeCount,
} from '@/app/actions/change-events'
import { listPendingImports } from '@/app/actions/law-list-import'
import { DocumentListPageContent } from '@/components/features/document-list/document-list-page-content'
import { DocumentListPageSkeleton } from '@/components/features/document-list/document-list-skeleton'
import { PendingImportsBanner } from '@/components/features/document-list/pending-imports-banner'
import { LawListTabs } from '@/components/features/changes/law-list-tabs'
import { LawListPrimaryAction } from '@/components/features/document-list/law-list-primary-action'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { hasPermission } from '@/lib/auth/permissions'

// Force dynamic rendering since this page requires authentication
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Laglistor | Laglig',
  description: 'Hantera dina listor och håll koll på relevanta rättsliga krav.',
}

export default async function DocumentListsPage() {
  // Fetch initial data server-side
  const [
    ctx,
    listsResult,
    defaultListResult,
    publishedTemplates,
    changesResult,
    changeCountResult,
    pendingImportsResult,
  ] = await Promise.all([
    getWorkspaceContext(),
    getDocumentLists(),
    getOrCreateDefaultList(),
    getPublishedTemplates(),
    getUnacknowledgedChanges(),
    getUnacknowledgedChangeCount(),
    listPendingImports(),
  ])

  const lists = listsResult.success ? (listsResult.data ?? []) : []
  const defaultListId = defaultListResult.success
    ? (defaultListResult.data?.id ?? null)
    : null
  const initialChanges = changesResult.success ? (changesResult.data ?? []) : []
  const initialChangeCount = changeCountResult.success
    ? (changeCountResult.data ?? 0)
    : 0
  const pendingImports = pendingImportsResult.success
    ? (pendingImportsResult.data ?? [])
    : []

  // Story 17.16: Gate compliance (kravpunkter + kommentar) edits by the tasks:edit permission.
  // AUDITORs lack this — they should see read-only UI instead of clicking buttons that 500.
  const complianceReadOnly = !hasPermission(ctx.role, 'tasks:edit')

  // Story 21.4: show "Skapa kontroll" CTA for users who can create cycles
  // AND have at least one laglista to scope the cycle against.
  const canCreateCycle =
    hasPermission(ctx.role, 'tasks:edit') && lists.length > 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Laglistor"
        subtitle="Hantera dina listor och håll koll på relevanta rättsliga krav."
        secondaryActions={
          canCreateCycle ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/laglistor/kontroller/skapa">
                <ClipboardCheck className="mr-1.5 h-4 w-4" aria-hidden />
                Skapa kontroll
              </Link>
            </Button>
          ) : null
        }
        primaryAction={<LawListPrimaryAction />}
      />

      {pendingImports.length > 0 && (
        <PendingImportsBanner imports={pendingImports} />
      )}

      <LawListTabs
        initialChangeCount={initialChangeCount}
        initialChanges={initialChanges}
      >
        <Suspense fallback={<DocumentListPageSkeleton />}>
          <DocumentListPageContent
            initialLists={lists}
            defaultListId={defaultListId}
            publishedTemplates={publishedTemplates}
            complianceReadOnly={complianceReadOnly}
            hasPendingImports={pendingImports.length > 0}
          />
        </Suspense>
      </LawListTabs>
    </div>
  )
}
