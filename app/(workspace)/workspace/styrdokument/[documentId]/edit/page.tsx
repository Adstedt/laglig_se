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
  searchParams: Promise<{
    // Story 14.24: present when the document was opened from an agent draft card.
    agentApprovalId?: string
    // Story 17.17 AC 1 v1.1 — `?view=approved` from the composite badge's
    // left-half click. Forces the editor to load the approved version's
    // content (NOT the draft) and renders read-only regardless of draft
    // state. Other values (or absence) → today's behaviour (Story 17.16
    // AC 13 explicit fallback chain: draft → approved → alias).
    view?: 'approved'
  }>
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
  viewMode,
}: {
  documentId: string
  agentApprovalId: string | undefined
  viewMode: 'approved' | 'default'
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
    approved_at: Date | null
    // Story 17.16 AC 13: dual-pointer versions. Editor reads draft when set
    // (a revision is in progress), else approved (never-approved DRAFT case),
    // else falls back to current_version (alias — should not be reachable
    // post-backfill but defensively retained).
    current_draft_version_id: string | null
    current_approved_version_id: string | null
    draft_status: 'DRAFT' | 'IN_REVIEW' | null
    current_draft_version: {
      content_json: Record<string, unknown>
      version_number: number
    } | null
    current_approved_version: {
      content_json: Record<string, unknown>
      version_number: number
    } | null
    current_version: {
      content_json: Record<string, unknown>
      created_at: string
    } | null
    creator: { name: string | null; email: string } | null
    approver: { name: string | null; email: string } | null
  }

  // Story 17.17 AC 1 v1.1 — `?view=approved` deep-link forces the read-only
  // approved view. Overrides Story 17.16 AC 13's default read order so the
  // editor loads `current_approved_version.content_json` (NOT the draft).
  // When the doc has no approved version (never-approved DRAFT), the override
  // gracefully falls through to the normal chain.
  const useApprovedView =
    viewMode === 'approved' && doc.current_approved_version != null

  // Story 17.16 AC 13 (Task 8): editor read order — draft → approved → alias
  // fallback. The deprecated current_version alias is FROZEN on the approved
  // version during a revision window (per Story 17.16 AC 4 + AC 5 + AC 11),
  // so reading the alias when a draft is in progress would silently load the
  // approved content as the editor's starting state — a data-loss class of
  // bug. Reading the draft pointer explicitly avoids this.
  const initialContent = useApprovedView
    ? doc.current_approved_version!.content_json
    : (doc.current_draft_version?.content_json ??
      doc.current_approved_version?.content_json ??
      doc.current_version?.content_json ?? {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      })

  // Story 17.17 AC 6 — derived approved metadata for the dual-state header
  // indicator. Sourced from the doc-level `approved_by`/`approved_at` (which
  // Story 17.16 preserves throughout the draft window — no longer NULL'd by
  // createDraftFromApproved) joined with the per-version `version_number`.
  const approvedMetadata =
    doc.current_approved_version != null && doc.approved_at != null
      ? {
          versionNumber: doc.current_approved_version.version_number,
          approverName: doc.approver?.name ?? doc.approver?.email ?? null,
          approvedAt:
            doc.approved_at instanceof Date
              ? doc.approved_at.toISOString()
              : String(doc.approved_at),
        }
      : null

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
          // Story 17.17 smoke-found polish: route the displayed version
          // number through the effective pointer chain instead of the doc's
          // `current_version_number` (which under Model B is a high-water
          // mark — e.g. after Förkasta on v7 it stays at 7 even though the
          // effective version is the approved v6 the user is now viewing).
          //
          // Priority:
          //   (a) viewMode='approved' → approved version_number
          //   (b) draft pointer set → draft version_number (dual-state edit)
          //   (c) approved pointer set → approved version_number
          //       (stable APPROVED, including post-Förkasta)
          //   (d) fallback → current_version_number (legacy / edge cases)
          versionNumber={
            viewMode === 'approved' && approvedMetadata != null
              ? approvedMetadata.versionNumber
              : (doc.current_draft_version?.version_number ??
                doc.current_approved_version?.version_number ??
                doc.current_version_number)
          }
          authorName={doc.creator?.name ?? doc.creator?.email ?? 'Okänd'}
          documentNumber={doc.document_number}
          reviewDate={doc.review_date}
          documentType={doc.document_type}
          latestComment={latestComment}
          currentDraftVersionId={doc.current_draft_version_id}
          currentApprovedVersionId={doc.current_approved_version_id}
          draftStatus={doc.draft_status}
          approvedMetadata={approvedMetadata}
          viewMode={viewMode}
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
  const { agentApprovalId, view } = await searchParams
  const viewMode: 'approved' | 'default' =
    view === 'approved' ? 'approved' : 'default'

  return (
    <Suspense fallback={<EditorSkeleton />}>
      <DocumentEditorLoader
        documentId={documentId}
        agentApprovalId={agentApprovalId}
        viewMode={viewMode}
      />
    </Suspense>
  )
}
