import { Suspense } from 'react'
import { CatalogueResults } from '@/components/features/catalogue/catalogue-results'
import { CatalogueFilters } from '@/components/features/catalogue/catalogue-filters'
import { CatalogueSearchBar } from '@/components/features/catalogue/catalogue-search-bar'
import { MobileFilterDrawer } from '@/components/features/catalogue/mobile-filter-drawer'
import { Skeleton } from '@/components/ui/skeleton'

interface WorkspaceForeskrifterPageProps {
  searchParams: Promise<{
    q?: string
    status?: string
    business?: string
    categories?: string
    from?: string
    to?: string
    page?: string
    per_page?: string
    sort?: string
  }>
}

export default async function WorkspaceForeskrifterPage({
  searchParams,
}: WorkspaceForeskrifterPageProps) {
  const params = await searchParams
  const query = params.q ?? ''
  const statusFilter = params.status?.split(',').filter(Boolean) ?? []
  const businessType = params.business as 'B2B' | 'PRIVATE' | 'BOTH' | undefined
  const categories = params.categories?.split(',').filter(Boolean) ?? []
  const dateFrom = params.from
  const dateTo = params.to
  const page = parseInt(params.page ?? '1', 10)
  const perPage = parseInt(params.per_page ?? '25', 10)
  const sortBy =
    (params.sort as 'date_desc' | 'date_asc' | 'title' | 'relevance') ??
    'date_desc'

  const contentTypes = ['AGENCY_REGULATION']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Myndighetsföreskrifter</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bläddra bland föreskrifter från svenska myndigheter
        </p>
      </div>

      <CatalogueSearchBar
        initialQuery={query}
        basePath="/browse/foreskrifter"
      />

      <div className="flex gap-8">
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <div className="sticky top-24">
            <CatalogueFilters
              selectedTypes={contentTypes}
              selectedStatus={statusFilter}
              selectedBusinessType={businessType}
              selectedCategories={categories}
              dateFrom={dateFrom}
              dateTo={dateTo}
              basePath="/browse/foreskrifter"
              showContentTypeFilter={false}
            />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 lg:hidden">
            <MobileFilterDrawer
              selectedTypes={contentTypes}
              selectedStatus={statusFilter}
              selectedBusinessType={businessType}
              selectedCategories={categories}
              dateFrom={dateFrom}
              dateTo={dateTo}
              basePath="/browse/foreskrifter"
              showContentTypeFilter={false}
            />
          </div>

          <Suspense fallback={<CatalogueResultsSkeleton />}>
            <CatalogueResults
              query={query}
              contentTypes={contentTypes}
              status={statusFilter}
              businessType={businessType}
              categories={categories}
              dateFrom={dateFrom}
              dateTo={dateTo}
              page={page}
              perPage={perPage}
              sortBy={sortBy}
              basePath="/browse/foreskrifter"
            />
          </Suspense>
        </main>
      </div>
    </div>
  )
}

function CatalogueResultsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="mb-6 flex items-start justify-between">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-9 w-[160px]" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5">
          <Skeleton className="mb-3 h-6 w-3/4" />
          <div className="mb-3 flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
      <div className="mt-8 flex justify-center">
        <Skeleton className="h-9 w-64" />
      </div>
    </div>
  )
}
