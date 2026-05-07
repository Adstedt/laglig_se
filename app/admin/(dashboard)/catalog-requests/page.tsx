/**
 * Story 24.5: admin queue for `CatalogIngestRequest` rows.
 *
 * Server component reads filter + range from URL params, calls
 * `listPendingCatalogRequests`, and hands hydrated data to the
 * `<CatalogRequestsList>` client component. Admin auth is layout-level
 * (`app/admin/(dashboard)/layout.tsx`) — no per-page wiring.
 */

import { listPendingCatalogRequests } from '@/app/actions/catalog-ingest-request'
import { CatalogRequestsList } from '@/components/admin/catalog-requests-list'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function asStatus(
  value: string | string[] | undefined
): 'pending' | 'fulfilled' | 'rejected' | 'all' {
  if (
    value === 'pending' ||
    value === 'fulfilled' ||
    value === 'rejected' ||
    value === 'all'
  ) {
    return value
  }
  return 'pending'
}

function asRangeDays(value: string | string[] | undefined): 7 | 30 | 90 {
  if (value === '7' || value === '30' || value === '90') {
    return Number(value) as 7 | 30 | 90
  }
  return 30
}

export default async function CatalogRequestsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const status = asStatus(params.status)
  const rangeDays = asRangeDays(params.range)

  const result = await listPendingCatalogRequests({ status, rangeDays })
  if (!result.success || !result.data) {
    return (
      <div className="rounded-md border border-destructive p-6 text-sm text-destructive">
        Kunde inte ladda katalogtilläggsförfrågningarna: {result.error}
      </div>
    )
  }

  return (
    <CatalogRequestsList
      initialRequests={result.data.requests}
      counts={result.data.counts}
      currentStatus={status}
      currentRangeDays={rangeDays}
    />
  )
}
