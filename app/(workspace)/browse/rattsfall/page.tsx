import { Suspense } from 'react'
import { CatalogueResults } from '@/components/features/catalogue/catalogue-results'
import { CatalogueFilters } from '@/components/features/catalogue/catalogue-filters'
import { CatalogueSearchBar } from '@/components/features/catalogue/catalogue-search-bar'
import { MobileFilterDrawer } from '@/components/features/catalogue/mobile-filter-drawer'
import { Skeleton } from '@/components/ui/skeleton'

interface WorkspaceRattsfallPageProps {
  searchParams: Promise<{
    q?: string
    types?: string
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

// All court case content types
const COURT_CASE_TYPES = [
  'COURT_CASE_AD',
  'COURT_CASE_HD',
  'COURT_CASE_HFD',
  'COURT_CASE_HOVR',
  'COURT_CASE_MOD',
  'COURT_CASE_MIG',
]

export default async function WorkspaceRattsfallPage({
  searchParams,
}: WorkspaceRattsfallPageProps) {
  const params = await searchParams
  const query = params.q ?? ''
  // Allow sub-filtering within court cases
  const selectedCourtTypes = params.types?.split(',').filter(Boolean) ?? []
  const contentTypes =
    selectedCourtTypes.length > 0
      ? selectedCourtTypes.filter((t) => COURT_CASE_TYPES.includes(t))
      : COURT_CASE_TYPES
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold">Svenska rättsfall</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bläddra bland rättsfall från svenska domstolar
        </p>
      </div>

      {/* Search Bar */}
      <CatalogueSearchBar initialQuery={query} basePath="/browse/rattsfall" />

      <div className="flex gap-8">
        {/* Filters Sidebar (Desktop) */}
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <div className="sticky top-24">
            <CatalogueFilters
              selectedTypes={selectedCourtTypes}
              selectedStatus={statusFilter}
              selectedBusinessType={businessType}
              selectedCategories={categories}
              dateFrom={dateFrom}
              dateTo={dateTo}
              basePath="/browse/rattsfall"
              showContentTypeFilter={true}
              contentTypeOptions="court_cases"
            />
          </div>
        </aside>

        {/* Results */}
        <main className="min-w-0 flex-1">
          {/* Mobile Filter Button */}
          <div className="mb-4 lg:hidden">
            <MobileFilterDrawer
              selectedTypes={selectedCourtTypes}
              selectedStatus={statusFilter}
              selectedBusinessType={businessType}
              selectedCategories={categories}
              dateFrom={dateFrom}
              dateTo={dateTo}
              basePath="/browse/rattsfall"
              showContentTypeFilter={true}
              contentTypeOptions="court_cases"
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
              basePath="/browse/rattsfall"
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
