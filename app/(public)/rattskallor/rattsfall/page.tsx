import { Suspense } from 'react'
import { CatalogueResults } from '@/components/features/catalogue/catalogue-results'
import { CatalogueFilters } from '@/components/features/catalogue/catalogue-filters'
import { CatalogueSearchBar } from '@/components/features/catalogue/catalogue-search-bar'
import { MobileFilterDrawer } from '@/components/features/catalogue/mobile-filter-drawer'
import { Skeleton } from '@/components/ui/skeleton'
import type { Metadata } from 'next'

interface RattsfallPageProps {
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

export const metadata: Metadata = {
  title: 'Svenska rättsfall | Laglig.se',
  description:
    'Bläddra bland svenska rättsfall från Arbetsdomstolen, Högsta domstolen, Hovrätterna och förvaltningsdomstolarna.',
  openGraph: {
    title: 'Svenska rättsfall | Laglig.se',
    description: 'Bläddra bland svenska rättsfall från alla domstolar.',
    type: 'website',
    locale: 'sv_SE',
  },
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

export default async function RattsfallPage({
  searchParams,
}: RattsfallPageProps) {
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
    <div className="container mx-auto px-4 py-8 md:py-12">
      {/* Page Header */}
      <div className="mb-8">
        <h1
          className="mb-2 text-2xl font-bold tracking-tight md:text-3xl"
          style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
        >
          Svenska rättsfall
        </h1>
        <p className="mb-4 text-muted-foreground">
          Bläddra bland rättsfall från svenska domstolar
        </p>
        <CatalogueSearchBar
          initialQuery={query}
          basePath="/rattskallor/rattsfall"
        />
      </div>

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
              basePath="/rattskallor/rattsfall"
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
              basePath="/rattskallor/rattsfall"
              showContentTypeFilter={true}
              contentTypeOptions="court_cases"
            />
          </div>

          <Suspense fallback={<RattsfallResultsSkeleton />}>
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
              basePath="/rattskallor/rattsfall"
            />
          </Suspense>
        </main>
      </div>
    </div>
  )
}

function RattsfallResultsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-9 w-32" />
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
