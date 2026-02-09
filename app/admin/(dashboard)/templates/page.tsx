import { TemplateTable } from '@/components/admin/template-table'
import { getTemplateList } from '@/lib/admin/template-queries'
import type { TemplateStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = new Set<string>([
  'DRAFT',
  'IN_REVIEW',
  'PUBLISHED',
  'ARCHIVED',
])

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams

  const search = typeof params.search === 'string' ? params.search : undefined
  const status =
    typeof params.status === 'string' && VALID_STATUSES.has(params.status)
      ? (params.status as TemplateStatus)
      : undefined
  const sortBy = typeof params.sortBy === 'string' ? params.sortBy : undefined
  const sortDir =
    params.sortDir === 'asc' ? ('asc' as const) : ('desc' as const)
  const page =
    typeof params.page === 'string'
      ? Math.max(1, parseInt(params.page, 10) || 1)
      : 1

  const pageSize = 25
  const result = await getTemplateList({
    search,
    status,
    sortBy,
    sortDir,
    page,
    pageSize,
  })

  return (
    <div className="space-y-6">
      <TemplateTable
        data={result.data}
        total={result.total}
        page={result.page}
        pageSize={pageSize}
        currentSearch={search}
        currentStatus={status}
        currentSortBy={sortBy ?? 'updated_at'}
        currentSortDir={sortDir}
      />
    </div>
  )
}
