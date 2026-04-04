import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { getDocument, getLatestStatusComment } from '@/app/actions/documents'
import { DocumentEditor } from '@/components/features/documents/editor/document-editor'
import { Skeleton } from '@/components/ui/skeleton'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Redigera dokument | Laglig',
}

interface PageProps {
  params: Promise<{ documentId: string }>
}

function EditorSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="flex-1 bg-muted/30 py-8">
        <div className="mx-auto w-full max-w-[210mm] bg-background shadow-md rounded-sm px-16 py-12 min-h-[297mm]">
          <Skeleton className="h-10 w-3/4 mb-6" />
          <Skeleton className="h-4 w-full mb-3" />
          <Skeleton className="h-4 w-5/6 mb-3" />
          <Skeleton className="h-4 w-4/6 mb-3" />
        </div>
      </div>
    </div>
  )
}

async function DocumentEditorLoader({ documentId }: { documentId: string }) {
  const [result, latestComment] = await Promise.all([
    getDocument(documentId),
    getLatestStatusComment(documentId),
  ])

  if (!result.success || !result.data) {
    notFound()
  }

  const doc = result.data as {
    id: string
    title: string
    status: string
    current_version_number: number
    document_number: string | null
    document_type: string
    review_date: string | null
    current_version: {
      content_json: Record<string, unknown>
      created_at: string
    } | null
    creator: { name: string | null; email: string } | null
  }

  return (
    <div
      data-document-id={doc.id}
      className="h-full -mx-4 -mb-4 md:-mx-6 md:-mb-6"
    >
      <DocumentEditor
        documentId={doc.id}
        initialTitle={doc.title}
        initialContent={
          doc.current_version?.content_json ?? {
            type: 'doc',
            content: [{ type: 'paragraph' }],
          }
        }
        status={doc.status}
        versionNumber={doc.current_version_number}
        authorName={doc.creator?.name ?? doc.creator?.email ?? 'Okänd'}
        documentNumber={doc.document_number}
        reviewDate={doc.review_date}
        documentType={doc.document_type}
        latestComment={latestComment}
      />
    </div>
  )
}

export default async function DocumentEditorPage({ params }: PageProps) {
  const { documentId } = await params

  return (
    <Suspense fallback={<EditorSkeleton />}>
      <DocumentEditorLoader documentId={documentId} />
    </Suspense>
  )
}
