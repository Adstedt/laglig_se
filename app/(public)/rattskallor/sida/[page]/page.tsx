/**
 * Static Pagination Route for Catalogue (Story 2.19, AC 7)
 *
 * Pre-generates first 10 pages of the default catalogue view at build time.
 * Uses route segment `/rattskallor/sida/[page]` instead of searchParams
 * to enable Next.js static generation with generateStaticParams.
 *
 * Why "sida" instead of "page":
 * - Swedish word for "page" matches the Swedish UI
 * - Avoids confusion with Next.js page.tsx file naming
 * - SEO-friendly Swedish URL structure
 */

import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { CatalogueResults } from '@/components/features/catalogue/catalogue-results'
import { CatalogueFilters } from '@/components/features/catalogue/catalogue-filters'
import { CatalogueSearchBar } from '@/components/features/catalogue/catalogue-search-bar'
import { MobileFilterDrawer } from '@/components/features/catalogue/mobile-filter-drawer'
import { Skeleton } from '@/components/ui/skeleton'
import type { Metadata } from 'next'

interface StaticPaginationPageProps {
  params: Promise<{ page: string }>
}

// Pre-generate first 10 pages at build time
export async function generateStaticParams() {
  return Array.from({ length: 10 }, (_, i) => ({
    page: String(i + 1),
  }))
}

// Allow ISR for pages beyond the first 10
export const dynamicParams = true

// Revalidate every hour
export const revalidate = 3600

export async function generateMetadata({
  params,
}: StaticPaginationPageProps): Promise<Metadata> {
  const { page: pageStr } = await params
  const page = parseInt(pageStr, 10)

  return {
    title:
      page === 1
        ? 'Bläddra i svensk lagstiftning | Laglig.se'
        : `Sida ${page} - Bläddra i svensk lagstiftning | Laglig.se`,
    description:
      'Utforska över 170 000 svenska lagar, rättsfall och EU-lagstiftning. Filtrera och bläddra i vår omfattande juridiska databas.',
    openGraph: {
      title:
        page === 1
          ? 'Bläddra i svensk lagstiftning | Laglig.se'
          : `Sida ${page} - Bläddra i svensk lagstiftning | Laglig.se`,
      description:
        'Utforska över 170 000 svenska lagar, rättsfall och EU-lagstiftning.',
      type: 'website',
      locale: 'sv_SE',
    },
    // Canonical URL handling for pagination
    alternates: {
      canonical: page === 1 ? '/rattskallor' : `/rattskallor/sida/${page}`,
    },
  }
}

export default async function StaticPaginationPage({
  params,
}: StaticPaginationPageProps) {
  const { page: pageStr } = await params
  const page = parseInt(pageStr, 10)

  // Validate page number
  if (isNaN(page) || page < 1) {
    notFound()
  }

  // Redirect page 1 to canonical URL (without /sida/1)
  if (page === 1) {
    redirect('/rattskallor')
  }

  // Max page limit to prevent abuse
  if (page > 1000) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      {/* Page Header */}
      <div className="mb-8">
        <h1
          className="mb-2 text-2xl font-bold tracking-tight md:text-3xl"
          style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
        >
          Rättskällor
        </h1>
        <p className="mb-4 text-muted-foreground">
          Bläddra bland svenska lagar, rättsfall och EU-lagstiftning
        </p>
        <CatalogueSearchBar initialQuery="" basePath="/rattskallor" />
      </div>

      <div className="flex gap-8">
        {/* Filters Sidebar (Desktop) */}
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <div className="sticky top-24">
            <CatalogueFilters
              selectedTypes={[]}
              selectedStatus={[]}
              selectedBusinessType={undefined}
              selectedCategories={[]}
              dateFrom={undefined}
              dateTo={undefined}
              basePath="/rattskallor"
              showContentTypeFilter={true}
            />
          </div>
        </aside>

        {/* Results */}
        <main className="min-w-0 flex-1">
          {/* Mobile Filter Button */}
          <div className="mb-4 lg:hidden">
            <MobileFilterDrawer
              selectedTypes={[]}
              selectedStatus={[]}
              selectedBusinessType={undefined}
              selectedCategories={[]}
              dateFrom={undefined}
              dateTo={undefined}
              basePath="/rattskallor"
              showContentTypeFilter={true}
            />
          </div>

          <Suspense fallback={<CatalogueResultsSkeleton />}>
            <CatalogueResults
              query=""
              contentTypes={[]}
              status={[]}
              businessType={undefined}
              categories={[]}
              dateFrom={undefined}
              dateTo={undefined}
              page={page}
              perPage={25}
              sortBy="date_desc"
              basePath="/rattskallor"
              useStaticPagination={true}
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
      {/* Results header skeleton */}
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Result cards skeleton */}
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

      {/* Pagination skeleton */}
      <div className="mt-8 flex justify-center">
        <Skeleton className="h-9 w-64" />
      </div>
    </div>
  )
}
