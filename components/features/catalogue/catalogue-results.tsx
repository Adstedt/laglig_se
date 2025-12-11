import { browseDocumentsAction } from '@/app/actions/browse'
import { CatalogueResultCard } from './catalogue-result-card'
import { CataloguePagination } from './catalogue-pagination'
import { CatalogueSortSelect } from './catalogue-sort-select'
import { AlertCircle, Library } from 'lucide-react'

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
  const result = await browseDocumentsAction({
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
  })

  if (result.error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="mb-2 text-lg font-semibold">Något gick fel</h2>
        <p className="max-w-md text-sm text-muted-foreground">{result.error}</p>
      </div>
    )
  }

  if (!result.success || result.results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Library className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-lg font-semibold">Inga dokument hittades</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {query
            ? `Vi hittade inga dokument som matchar "${query}". Försök med andra sökord eller ta bort filter.`
            : 'Inga dokument matchar de valda filtren. Försök med andra filter.'}
        </p>
      </div>
    )
  }

  const startIndex = (page - 1) * perPage + 1
  const endIndex = Math.min(page * perPage, result.total)

  return (
    <div>
      {/* Results Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Visar {startIndex.toLocaleString('sv-SE')}-
          {endIndex.toLocaleString('sv-SE')} av{' '}
          <span className="font-medium text-foreground">
            {result.total.toLocaleString('sv-SE')}
          </span>{' '}
          dokument
          {result.queryTimeMs && (
            <span className="ml-2 text-xs">
              ({result.queryTimeMs.toFixed(0)}ms)
            </span>
          )}
        </p>
        <CatalogueSortSelect currentSort={sortBy} basePath={basePath} />
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {result.results.map((doc, index) => (
          <CatalogueResultCard
            key={doc.id}
            document={doc}
            query={query}
            position={startIndex + index}
          />
        ))}
      </div>

      {/* Pagination */}
      {result.totalPages > 1 && (
        <div className="mt-8">
          <CataloguePagination
            currentPage={page}
            totalPages={result.totalPages}
            perPage={perPage}
            total={result.total}
            basePath={basePath}
            useStaticPagination={useStaticPagination}
          />
        </div>
      )}
    </div>
  )
}
