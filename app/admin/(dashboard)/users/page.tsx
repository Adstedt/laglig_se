import { UserTable } from '@/components/admin/user-table'
import { getUserList } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams

  const search = typeof params.search === 'string' ? params.search : undefined
  const sortBy = typeof params.sortBy === 'string' ? params.sortBy : undefined
  const sortDir =
    params.sortDir === 'asc' ? ('asc' as const) : ('desc' as const)
  const page =
    typeof params.page === 'string'
      ? Math.max(1, parseInt(params.page, 10) || 1)
      : 1

  const pageSize = 25
  const result = await getUserList({
    search,
    sortBy,
    sortDir,
    page,
    pageSize,
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Användare</h1>
      <UserTable
        data={result.data}
        total={result.total}
        page={result.page}
        pageSize={pageSize}
        currentSearch={search}
        currentSortBy={sortBy ?? 'created_at'}
        currentSortDir={sortDir}
      />
    </div>
  )
}
