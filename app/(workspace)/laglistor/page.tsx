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

// Force dynamic rendering since this page requires authentication
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Mina listor | Laglig',
  description: 'Hantera dina listor och håll koll på relevanta rättsliga krav.',
}

export default async function DocumentListsPage() {
  // Fetch initial data server-side
  const [
    listsResult,
    defaultListResult,
    publishedTemplates,
    changesResult,
    changeCountResult,
  ] = await Promise.all([
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Mina listor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hantera dina listor och håll koll på relevanta rättsliga krav.
        </p>
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
          />
        </Suspense>
      </LawListTabs>
    </div>
  )
}
