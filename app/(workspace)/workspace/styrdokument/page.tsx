import { Metadata } from 'next'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { DocumentBrowserPage } from '@/components/features/documents/document-browser-page'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Styrdokument | Laglig',
}

function BrowserSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-1 h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}

export default function WorkspaceDocumentsPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<BrowserSkeleton />}>
        <DocumentBrowserPage />
      </Suspense>
    </div>
  )
}
