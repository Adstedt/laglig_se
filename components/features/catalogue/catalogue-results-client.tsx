'use client'

import { useEffect } from 'react'
import {
  useCatalogueBrowse,
  prefetchBrowse,
} from '@/lib/hooks/use-catalogue-browse'
import { CatalogueResultCard } from './catalogue-result-card'
import { CataloguePagination } from './catalogue-pagination'
import { CatalogueSortSelect } from './catalogue-sort-select'
import { CataloguePrefetcher } from './catalogue-prefetcher'
import { AlertCircle, Library, Loader2 } from 'lucide-react'
import type { BrowseInput, BrowseResponse } from '@/app/actions/browse'

// Common filter combinations to prefetch on page load
const PREFETCH_FILTERS: Partial<BrowseInput>[] = [
  { contentTypes: ['SFS_LAW'] }, // /lagar
  {
    contentTypes: [
      'COURT_CASE_AD',
      'COURT_CASE_HD',
      'COURT_CASE_HFD',
      'COURT_CASE_HOVR',
      'COURT_CASE_MOD',
      'COURT_CASE_MIG',
    ],
  }, // /rattsfall
  { contentTypes: ['EU_REGULATION', 'EU_DIRECTIVE'] }, // /eu
  { status: ['ACTIVE'] }, // Common status filter
]

interface CatalogueResultsClientProps {
  input: BrowseInput
  initialData: BrowseResponse
  basePath: string
  useStaticPagination?: boolean
}

/**
 * Client-side catalogue results component
 *
 * Uses SWR with stale-while-revalidate pattern:
 * - Shows initial SSR data immediately
 * - Revalidates in background when filters/page change
 * - keepPreviousData prevents skeleton flash during transitions
 * - Shows subtle loading indicator during revalidation
 */
export function CatalogueResultsClient({
  input,
  initialData,
  basePath,
  useStaticPagination = false,
}: CatalogueResultsClientProps) {
  const {
    results,
    total,
    page,
    totalPages,
    queryTimeMs,
    isLoading,
    isValidating,
    error,
  } = useCatalogueBrowse(input, initialData)

  // Detect workspace mode from basePath - workspace routes use /browse prefix
  const isWorkspace = basePath.startsWith('/browse')

  // Prefetch common filter combinations on mount for instant filter switches
  useEffect(() => {
    // Only prefetch on the main catalogue page (no filters applied)
    const hasNoFilters =
      !input.contentTypes?.length &&
      !input.status?.length &&
      !input.businessType &&
      !input.subjectCodes?.length &&
      !input.query

    if (hasNoFilters) {
      // Stagger prefetches to avoid network congestion
      PREFETCH_FILTERS.forEach((filter, index) => {
        setTimeout(() => {
          prefetchBrowse({
            ...filter,
            page: 1,
            limit: input.limit || 25,
            sortBy: input.sortBy || 'date_desc',
          } as BrowseInput)
        }, index * 200) // 200ms stagger
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount - intentionally empty deps

  // Show subtle loading indicator during revalidation (not skeleton!)
  const showLoadingIndicator = isValidating && !isLoading

  // Error state - only show if no cached data
  if (error && results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="mb-2 text-lg font-semibold">Något gick fel</h2>
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  // Empty state
  if (results.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Library className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-lg font-semibold">Inga dokument hittades</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {input.query
            ? `Vi hittade inga dokument som matchar "${input.query}". Försök med andra sökord eller ta bort filter.`
            : 'Inga dokument matchar de valda filtren. Försök med andra filter.'}
        </p>
      </div>
    )
  }

  const perPage = input.limit || 25
  const startIndex = (page - 1) * perPage + 1
  const endIndex = Math.min(page * perPage, total)

  return (
    <div>
      {/* Results Header - with subtle loading indicator */}
      <div className="mb-6 flex items-start justify-between">
        <p className="flex h-5 items-center gap-2 text-sm leading-5 text-muted-foreground">
          <span>
            Visar {startIndex.toLocaleString('sv-SE')}-
            {endIndex.toLocaleString('sv-SE')} av{' '}
            <span className="font-medium text-foreground">
              {total.toLocaleString('sv-SE')}
            </span>{' '}
            dokument
          </span>
          {queryTimeMs && (
            <span className="text-xs">({queryTimeMs.toFixed(0)}ms)</span>
          )}
          {showLoadingIndicator && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </p>
        <CatalogueSortSelect
          currentSort={input.sortBy || 'date_desc'}
          basePath={basePath}
        />
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {results.map((doc, index) => (
          <CatalogueResultCard
            key={doc.id}
            document={doc}
            query={input.query || ''}
            position={startIndex + index}
            isWorkspace={isWorkspace}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8">
          <CataloguePagination
            currentPage={page}
            totalPages={totalPages}
            perPage={perPage}
            total={total}
            basePath={basePath}
            useStaticPagination={useStaticPagination}
          />
        </div>
      )}

      {/* Cross-page prefetcher for instant navigation */}
      <CataloguePrefetcher currentPage={page} totalPages={totalPages} />
    </div>
  )
}
