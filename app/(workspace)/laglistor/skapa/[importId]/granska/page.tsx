/**
 * Story 24.4: review surface for an in-flight or completed import.
 *
 * Server component that loads the import via `getImport`, verifies workspace
 * scoping + status (only AWAITING_REVIEW / COMMITTED / FAILED / MATCHING are
 * reviewable — UPLOADED is mid-processing in 24.2 and gets bounced to
 * `/laglistor`), and hands the hydrated data to `<ImportReviewPage>`.
 *
 * Per AC 12, the MATCHING-state polling lives client-side via SWR. We hand
 * the initial server-side load down so the first paint is fully populated;
 * the client refetches via the same `getImport` action while polling.
 */

import { redirect } from 'next/navigation'
import { getImport } from '@/app/actions/law-list-import'
import { ImportReviewPage } from '@/components/features/law-list-import/import-review-page'
import { BreadcrumbOverride } from '@/components/layout/breadcrumb-override'

interface PageProps {
  params: Promise<{ importId: string }>
}

export default async function ImportReviewRoute({ params }: PageProps) {
  const { importId } = await params

  const result = await getImport(importId)
  if (!result.success || !result.data) {
    redirect('/laglistor')
  }

  // UPLOADED is the brief "rows persisted, matching not yet started" state in
  // 24.2's flow. The user shouldn't land on the review surface in that
  // state — bounce them back to the laglistor index.
  if (result.data.status === 'UPLOADED') {
    redirect('/laglistor')
  }

  return (
    <>
      <BreadcrumbOverride label="Granska import" />
      <ImportReviewPage initialImport={result.data} />
    </>
  )
}
