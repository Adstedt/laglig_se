import { browseDocumentsAction, type BrowseInput } from '@/app/actions/browse'
import { CatalogueResultsClient } from './catalogue-results-client'

interface CatalogueResultsProps {
  query: string
  contentTypes: string[]
  status: string[]
  businessType: string | undefined
  categories: string[]
  dateFrom: string | undefined
  dateTo: string | undefined
  page: number
  perPage: number
  sortBy: 'date_desc' | 'date_asc' | 'title' | 'relevance'
  basePath: string
  /** Use /rattskallor/sida/[page] route for pagination instead of ?page= */
  useStaticPagination?: boolean
}

/**
 * Server-side catalogue results component
 *
 * Hybrid SSR + SWR approach:
 * 1. Server fetches data and renders initial HTML (fast first paint)
 * 2. Client hydrates with SWR using server data as initialData
 * 3. Subsequent filter/page changes use SWR's stale-while-revalidate
 *
 * Benefits:
 * - SEO: Full HTML rendered server-side
 * - Performance: No skeleton flash on filter changes (keepPreviousData)
 * - UX: Instant feedback with subtle loading indicator
 */
export async function CatalogueResults({
  query,
  contentTypes,
  status,
  businessType,
  categories,
  dateFrom,
  dateTo,
  page,
  perPage,
  sortBy,
  basePath,
  useStaticPagination = false,
}: CatalogueResultsProps) {
  // Build the input object for both server fetch and client SWR
  const input: BrowseInput = {
    query: query || undefined,
    contentTypes:
      contentTypes.length > 0
        ? (contentTypes as (
            | 'SFS_LAW'
            | 'COURT_CASE_AD'
            | 'COURT_CASE_HD'
            | 'COURT_CASE_HFD'
            | 'COURT_CASE_HOVR'
            | 'COURT_CASE_MOD'
            | 'COURT_CASE_MIG'
            | 'EU_REGULATION'
            | 'EU_DIRECTIVE'
          )[])
        : undefined,
    status:
      status.length > 0
        ? (status as ('ACTIVE' | 'REPEALED' | 'DRAFT' | 'ARCHIVED')[])
        : undefined,
    businessType: businessType as 'B2B' | 'PRIVATE' | 'BOTH' | undefined,
    subjectCodes: categories.length > 0 ? categories : undefined,
    dateFrom,
    dateTo,
    page,
    limit: perPage,
    sortBy,
  }

  // Fetch data server-side for initial render
  const initialData = await browseDocumentsAction(input)

  // Pass to client component with SWR for subsequent interactions
  return (
    <CatalogueResultsClient
      input={input}
      initialData={initialData}
      basePath={basePath}
      useStaticPagination={useStaticPagination}
    />
  )
}
