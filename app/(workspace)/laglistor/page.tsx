/**
 * Story 4.11: Document Lists Page
 * Story 8.1: Added "Ändringar" tab via LawListTabs wrapper
 * Main page for viewing and managing personalized document lists
 */

import { Suspense } from 'react'
import { Metadata } from 'next'
import {
  getDocumentLists,
  getOrCreateDefaultList,
} from '@/app/actions/document-list'
import { getPublishedTemplates } from '@/lib/db/queries/template-catalog'
import {
  getUnacknowledgedChanges,
  getUnacknowledgedChangeCount,
} from '@/app/actions/change-events'
import { DocumentListPageContent } from '@/components/features/document-list/document-list-page-content'
import { DocumentListPageSkeleton } from '@/components/features/document-list/document-list-skeleton'
import { LawListTabs } from '@/components/features/changes/law-list-tabs'
import { RegenerateLawListButton } from '@/components/features/document-list/regenerate-law-list-button'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { hasPermission } from '@/lib/auth/permissions'

// Force dynamic rendering since this page requires authentication
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Mina listor | Laglig',
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
  ] = await Promise.all([
    getWorkspaceContext(),
    getDocumentLists(),
    getOrCreateDefaultList(),
    getPublishedTemplates(),
    getUnacknowledgedChanges(),
    getUnacknowledgedChangeCount(),
  ])

  const lists = listsResult.success ? (listsResult.data ?? []) : []
  const defaultListId = defaultListResult.success
    ? (defaultListResult.data?.id ?? null)
    : null
  const initialChanges = changesResult.success ? (changesResult.data ?? []) : []
  const initialChangeCount = changeCountResult.success
    ? (changeCountResult.data ?? 0)
    : 0

  // Story 17.16: Gate compliance (kravpunkter + kommentar) edits by the tasks:edit permission.
  // AUDITORs lack this — they should see read-only UI instead of clicking buttons that 500.
  const complianceReadOnly = !hasPermission(ctx.role, 'tasks:edit')

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mina listor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hantera dina listor och håll koll på relevanta rättsliga krav.
          </p>
        </div>
        <RegenerateLawListButton />
      </div>

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
          />
        </Suspense>
      </LawListTabs>
    </div>
  )
}
