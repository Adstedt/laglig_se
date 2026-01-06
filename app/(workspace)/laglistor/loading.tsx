/**
 * Story 4.11: Document Lists Loading State
 */

import { DocumentListPageSkeleton } from '@/components/features/document-list/document-list-skeleton'

export default function DocumentListsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="mt-1 h-5 w-96 bg-muted animate-pulse rounded" />
      </div>
      <DocumentListPageSkeleton />
    </div>
  )
}
