import { Suspense } from 'react'
import { SearchResults } from '@/components/features/search/search-results'
import { SearchFilters } from '@/components/features/search/search-filters'
import { SearchBar } from '@/components/features/search/search-bar'
import { MobileFilterDrawer } from '@/components/features/search/mobile-filter-drawer'
import { Skeleton } from '@/components/ui/skeleton'
import type { Metadata } from 'next'

interface SearchPageProps {
  searchParams: Promise<{
    q?: string
    types?: string
    status?: string
    business?: string
    categories?: string
    from?: string
    to?: string
    page?: string
  }>
}

export const metadata: Metadata = {
  title: 'Sök i svensk lagstiftning | Laglig.se',
  description:
    'Sök bland 100 000+ svenska lagar, rättsfall och EU-lagstiftning.',
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query = params.q ?? ''
  const contentTypes = params.types?.split(',').filter(Boolean) ?? []
  const statusFilter = params.status?.split(',').filter(Boolean) ?? []
  const businessType = params.business as 'B2B' | 'PRIVATE' | 'BOTH' | undefined
  const categories = params.categories?.split(',').filter(Boolean) ?? []
  const dateFrom = params.from
  const dateTo = params.to
  const page = parseInt(params.page ?? '1', 10)

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      {/* Search Header */}
      <div className="mb-8">
        <h1
          className="mb-4 text-2xl font-bold tracking-tight md:text-3xl"
          style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
        >
          Sök i lagdatabasen
        </h1>
        <SearchBar initialQuery={query} />
      </div>

      <div className="flex gap-8">
        {/* Filters Sidebar (Desktop) */}
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <div className="sticky top-24">
            <SearchFilters
              selectedTypes={contentTypes}
              selectedStatus={statusFilter}
              selectedBusinessType={businessType}
              selectedCategories={categories}
              dateFrom={dateFrom}
              dateTo={dateTo}
            />
          </div>
        </aside>

        {/* Results */}
        <main className="min-w-0 flex-1">
          {/* Mobile Filter Button */}
          <div className="mb-4 lg:hidden">
            <MobileFilterDrawer
              selectedTypes={contentTypes}
              selectedStatus={statusFilter}
              selectedBusinessType={businessType}
              selectedCategories={categories}
              dateFrom={dateFrom}
              dateTo={dateTo}
            />
          </div>

          <Suspense fallback={<SearchResultsSkeleton />}>
            <SearchResults
              query={query}
              contentTypes={contentTypes}
              status={statusFilter}
              businessType={businessType}
              categories={categories}
              dateFrom={dateFrom}
              dateTo={dateTo}
              page={page}
            />
          </Suspense>
        </main>
      </div>
    </div>
  )
}

function SearchResultsSkeleton() {
  return (
    <div className="space-y-4">
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
    </div>
  )
}
