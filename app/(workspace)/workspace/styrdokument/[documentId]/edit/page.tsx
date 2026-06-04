import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { getDocument, getLatestStatusComment } from '@/app/actions/documents'
import { DocumentEditor } from '@/components/features/documents/editor/document-editor'
import { PendingAgentApprovalBanner } from '@/components/features/documents/pending-agent-approval-banner'
import { Skeleton } from '@/components/ui/skeleton'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Redigera dokument | Laglig',
}

interface PageProps {
  params: Promise<{ documentId: string }>
  // Story 14.24: present when the document was opened from an agent draft card.
  searchParams: Promise<{ agentApprovalId?: string }>
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

async function DocumentEditorLoader({
  documentId,
  agentApprovalId,
}: {
  documentId: string
  agentApprovalId: string | undefined
}) {
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
    // Story 17.16 AC 13: dual-pointer versions. Editor reads draft when set
    // (a revision is in progress), else approved (never-approved DRAFT case),
    // else falls back to current_version (alias — should not be reachable
    // post-backfill but defensively retained).
    current_draft_version: {
      content_json: Record<string, unknown>
    } | null
    current_approved_version: {
      content_json: Record<string, unknown>
    } | null
    current_version: {
      content_json: Record<string, unknown>
      created_at: string
    } | null
    creator: { name: string | null; email: string } | null
  }

  // Story 17.16 AC 13 (Task 8): editor read order — draft → approved → alias
  // fallback. The deprecated current_version alias is FROZEN on the approved
  // version during a revision window (per Story 17.16 AC 4 + AC 5 + AC 11),
  // so reading the alias when a draft is in progress would silently load the
  // approved content as the editor's starting state — a data-loss class of
  // bug (the user's edits would replay against the approved baseline instead
  // of the draft baseline, effectively reverting whatever draft-only state
  // existed). Reading the draft pointer explicitly avoids this.
  const initialContent = doc.current_draft_version?.content_json ??
    doc.current_approved_version?.content_json ??
    doc.current_version?.content_json ?? {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    }

  return (
    <div className="flex h-full flex-col">
      {agentApprovalId && (
        <div className="shrink-0 px-4 pt-3 md:px-6">
          <PendingAgentApprovalBanner pendingActionId={agentApprovalId} />
        </div>
      )}
      <div
        data-document-id={doc.id}
        className="min-h-0 flex-1 -mx-4 -mb-4 md:-mx-6 md:-mb-6"
      >
        <DocumentEditor
          documentId={doc.id}
          initialTitle={doc.title}
          initialContent={initialContent}
          status={doc.status}
          versionNumber={doc.current_version_number}
          authorName={doc.creator?.name ?? doc.creator?.email ?? 'Okänd'}
          documentNumber={doc.document_number}
          reviewDate={doc.review_date}
          documentType={doc.document_type}
          latestComment={latestComment}
        />
      </div>
    </div>
  )
}

export default async function DocumentEditorPage({
  params,
  searchParams,
}: PageProps) {
  const { documentId } = await params
  const { agentApprovalId } = await searchParams

  return (
    <Suspense fallback={<EditorSkeleton />}>
      <DocumentEditorLoader
        documentId={documentId}
        agentApprovalId={agentApprovalId}
      />
    </Suspense>
  )
}
