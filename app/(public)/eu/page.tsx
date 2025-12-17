import { Suspense } from 'react'
import { CatalogueResults } from '@/components/features/catalogue/catalogue-results'
import { CatalogueFilters } from '@/components/features/catalogue/catalogue-filters'
import { CatalogueSearchBar } from '@/components/features/catalogue/catalogue-search-bar'
import { MobileFilterDrawer } from '@/components/features/catalogue/mobile-filter-drawer'
import { Skeleton } from '@/components/ui/skeleton'
import type { Metadata } from 'next'

interface EuPageProps {
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
  title: 'EU-lagstiftning | Laglig.se',
  description:
    'Bläddra bland EU-förordningar och EU-direktiv som gäller i Sverige.',
  openGraph: {
    title: 'EU-lagstiftning | Laglig.se',
    description:
      'Bläddra bland EU-förordningar och EU-direktiv som gäller i Sverige.',
    type: 'website',
    locale: 'sv_SE',
  },
}

// EU legislation content types
const EU_TYPES = ['EU_REGULATION', 'EU_DIRECTIVE']

export default async function EuPage({ searchParams }: EuPageProps) {
  const params = await searchParams
  const query = params.q ?? ''
  // Allow sub-filtering within EU legislation
  const selectedEuTypes = params.types?.split(',').filter(Boolean) ?? []
  const contentTypes =
    selectedEuTypes.length > 0
      ? selectedEuTypes.filter((t) => EU_TYPES.includes(t))
      : EU_TYPES
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
          EU-lagstiftning
        </h1>
        <p className="mb-4 text-muted-foreground">
          Bläddra bland EU-förordningar och EU-direktiv
        </p>
        <CatalogueSearchBar initialQuery={query} basePath="/eu" />
      </div>

      <div className="flex gap-8">
        {/* Filters Sidebar (Desktop) */}
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <div className="sticky top-24">
            <CatalogueFilters
              selectedTypes={selectedEuTypes}
              selectedStatus={statusFilter}
              selectedBusinessType={businessType}
              selectedCategories={categories}
              dateFrom={dateFrom}
              dateTo={dateTo}
              basePath="/eu"
              showContentTypeFilter={true}
              contentTypeOptions="eu"
            />
          </div>
        </aside>

        {/* Results */}
        <main className="min-w-0 flex-1">
          {/* Mobile Filter Button */}
          <div className="mb-4 lg:hidden">
            <MobileFilterDrawer
              selectedTypes={selectedEuTypes}
              selectedStatus={statusFilter}
              selectedBusinessType={businessType}
              selectedCategories={categories}
              dateFrom={dateFrom}
              dateTo={dateTo}
              basePath="/eu"
              showContentTypeFilter={true}
              contentTypeOptions="eu"
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
              basePath="/eu"
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
