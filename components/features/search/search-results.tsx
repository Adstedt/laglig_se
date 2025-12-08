import { searchDocumentsAction } from '@/app/actions/search'
import { SearchResultCard } from './search-result-card'
import { Pagination } from './pagination'
import { AlertCircle, Search } from 'lucide-react'

interface SearchResultsProps {
  query: string
  contentTypes: string[]
  status: string[]
  businessType: string | undefined
  categories: string[]
  dateFrom: string | undefined
  dateTo: string | undefined
  page: number
}

export async function SearchResults({
  query,
  contentTypes,
  status,
  businessType,
  categories,
  dateFrom,
  dateTo,
  page,
}: SearchResultsProps) {
  if (!query) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-lg font-semibold">Börja söka</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Du kan söka på lagens namn, SFS-nummer, nyckelord eller juridiska
          termer
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {['Arbetsmiljölagen', 'GDPR', 'Bokföringslagen'].map((term) => (
            <a
              key={term}
              href={`/sok?q=${encodeURIComponent(term)}`}
              className="rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            >
              {term}
            </a>
          ))}
        </div>
      </div>
    )
  }

  const result = await searchDocumentsAction({
    query,
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
    limit: 20,
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
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-lg font-semibold">Inga resultat</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Vi hittade inga dokument för &quot;
          <span className="font-medium">{query}</span>&quot;. Prova att ändra
          sökord eller ta bort filter.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Results Header */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Visar {(page - 1) * 20 + 1}-{Math.min(page * 20, result.total)} av{' '}
          <span className="font-medium text-foreground">
            {result.total.toLocaleString('sv-SE')}
          </span>{' '}
          träffar
          <span className="ml-2 text-xs">
            ({result.queryTimeMs.toFixed(0)}ms)
          </span>
        </p>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {result.results.map((doc, index) => (
          <SearchResultCard
            key={doc.id}
            document={doc}
            query={query}
            position={(page - 1) * 20 + index + 1}
          />
        ))}
      </div>

      {/* Pagination */}
      {result.totalPages > 1 && (
        <div className="mt-8">
          <Pagination
            currentPage={page}
            totalPages={result.totalPages}
            baseUrl={`/sok?q=${encodeURIComponent(query)}`}
          />
        </div>
      )}
    </div>
  )
}
