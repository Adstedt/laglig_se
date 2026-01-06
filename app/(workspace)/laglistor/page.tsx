/**
 * Story 4.11: Document Lists Page
 * Main page for viewing and managing personalized document lists
 */

import { Suspense } from 'react'
import { Metadata } from 'next'
import { getDocumentLists, getOrCreateDefaultList } from '@/app/actions/document-list'
import { DocumentListPageContent } from '@/components/features/document-list/document-list-page-content'
import { DocumentListPageSkeleton } from '@/components/features/document-list/document-list-skeleton'

export const metadata: Metadata = {
  title: 'Mina laglistor | Laglig',
  description: 'Hantera dina personliga laglistor och håll koll på relevanta rättsliga krav.',
}

export default async function DocumentListsPage() {
  // Fetch initial data server-side
  const [listsResult, defaultListResult] = await Promise.all([
    getDocumentLists(),
    getOrCreateDefaultList(),
  ])

  const lists = listsResult.success ? listsResult.data ?? [] : []
  const defaultListId = defaultListResult.success ? (defaultListResult.data?.id ?? null) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mina laglistor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hantera dina laglistor och håll koll på relevanta rättsliga krav.
        </p>
      </div>

      <Suspense fallback={<DocumentListPageSkeleton />}>
        <DocumentListPageContent
          initialLists={lists}
          defaultListId={defaultListId}
        />
      </Suspense>
    </div>
  )
}
