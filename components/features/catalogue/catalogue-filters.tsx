'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { X, Loader2 } from 'lucide-react'
import { prefetchBrowse } from '@/lib/hooks/use-catalogue-browse'
import type { BrowseInput } from '@/app/actions/browse'

// All content types
const ALL_CONTENT_TYPES = [
  {
    value: 'SFS_LAW',
    label: 'Lagar (SFS)',
    color:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  },
  {
    value: 'COURT_CASE_AD',
    label: 'Arbetsdomstolen',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  {
    value: 'COURT_CASE_HD',
    label: 'Högsta domstolen',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  {
    value: 'COURT_CASE_HFD',
    label: 'Högsta förvaltningsdomstolen',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  {
    value: 'COURT_CASE_HOVR',
    label: 'Hovrätterna',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  {
    value: 'COURT_CASE_MOD',
    label: 'Mark- och miljööverdomstolen',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  {
    value: 'COURT_CASE_MIG',
    label: 'Migrationsöverdomstolen',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  {
    value: 'EU_REGULATION',
    label: 'EU-förordningar',
    color:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  },
  {
    value: 'EU_DIRECTIVE',
    label: 'EU-direktiv',
    color:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  },
]

// Court case types only
const COURT_CASE_TYPES = [
  {
    value: 'COURT_CASE_AD',
    label: 'Arbetsdomstolen',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  {
    value: 'COURT_CASE_HD',
    label: 'Högsta domstolen',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  {
    value: 'COURT_CASE_HFD',
    label: 'Högsta förvaltningsdomstolen',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  {
    value: 'COURT_CASE_HOVR',
    label: 'Hovrätterna',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  {
    value: 'COURT_CASE_MOD',
    label: 'Mark- och miljööverdomstolen',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  {
    value: 'COURT_CASE_MIG',
    label: 'Migrationsöverdomstolen',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
]

// EU types only
const EU_TYPES = [
  {
    value: 'EU_REGULATION',
    label: 'EU-förordningar',
    color:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  },
  {
    value: 'EU_DIRECTIVE',
    label: 'EU-direktiv',
    color:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  },
]

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Gällande' },
  { value: 'REPEALED', label: 'Upphävd' },
  { value: 'DRAFT', label: 'Utkast' },
  { value: 'ARCHIVED', label: 'Arkiverad' },
]

const BUSINESS_TYPES = [
  { value: 'B2B', label: 'Företag (B2B)' },
  { value: 'PRIVATE', label: 'Privatperson' },
  { value: 'BOTH', label: 'Båda' },
]

const CATEGORIES = [
  { value: 'arbetsratt', label: 'Arbetsrätt' },
  { value: 'dataskydd', label: 'Dataskydd' },
  { value: 'skatteratt', label: 'Skatterätt' },
  { value: 'bolagsratt', label: 'Bolagsrätt' },
  { value: 'miljo-bygg', label: 'Miljö & Bygg' },
  { value: 'livsmedel-halsa', label: 'Livsmedel & Hälsa' },
  { value: 'finans', label: 'Finans' },
  { value: 'immaterialratt', label: 'Immaterialrätt' },
  { value: 'konsumentskydd', label: 'Konsumentskydd' },
  { value: 'transport-logistik', label: 'Transport & Logistik' },
]

interface CatalogueFiltersProps {
  selectedTypes: string[]
  selectedStatus: string[]
  selectedBusinessType: string | undefined
  selectedCategories: string[]
  dateFrom: string | undefined
  dateTo: string | undefined
  basePath: string
  showContentTypeFilter: boolean
  contentTypeOptions?: 'all' | 'court_cases' | 'eu'
  hideHeader?: boolean
}

export function CatalogueFilters({
  selectedTypes,
  selectedStatus,
  selectedBusinessType,
  selectedCategories,
  dateFrom,
  dateTo,
  basePath,
  showContentTypeFilter,
  contentTypeOptions = 'all',
  hideHeader = false,
}: CatalogueFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const getContentTypes = () => {
    switch (contentTypeOptions) {
      case 'court_cases':
        return COURT_CASE_TYPES
      case 'eu':
        return EU_TYPES
      default:
        return ALL_CONTENT_TYPES
    }
  }

  const updateFilters = useCallback(
    (key: string, value: string | string[] | undefined) => {
      const params = new URLSearchParams(searchParams.toString())

      if (
        value === undefined ||
        (Array.isArray(value) && value.length === 0) ||
        value === ''
      ) {
        params.delete(key)
      } else if (Array.isArray(value)) {
        params.set(key, value.join(','))
      } else {
        params.set(key, value)
      }

      // Reset to page 1 when filters change
      params.delete('page')

      const queryString = params.toString()
      const newUrl = queryString ? `${basePath}?${queryString}` : basePath

      // Use startTransition for non-blocking navigation
      // This keeps the UI responsive while the route updates
      startTransition(() => {
        router.push(newUrl, { scroll: false })
      })
    },
    [router, searchParams, basePath]
  )

  const toggleArrayFilter = (
    key: string,
    value: string,
    currentValues: string[]
  ) => {
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value]
    updateFilters(key, newValues)
  }

  const clearAllFilters = () => {
    const params = new URLSearchParams()
    const query = searchParams.get('q')
    if (query) params.set('q', query)
    const queryString = params.toString()
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath

    startTransition(() => {
      router.push(newUrl, { scroll: false })
    })
  }

  const hasFilters =
    selectedTypes.length > 0 ||
    selectedStatus.length > 0 ||
    selectedBusinessType ||
    selectedCategories.length > 0 ||
    dateFrom ||
    dateTo

  // Build anticipated BrowseInput for prefetching on hover
  const buildPrefetchInput = useCallback(
    (changes: {
      types?: string[]
      status?: string[]
      business?: string | undefined
      categories?: string[]
    }): BrowseInput => {
      const query = searchParams.get('q') || undefined
      const sortBy =
        (searchParams.get('sort') as
          | 'date_desc'
          | 'date_asc'
          | 'title'
          | 'relevance') || 'date_desc'
      const limit = parseInt(searchParams.get('per_page') || '25', 10)

      return {
        query,
        contentTypes:
          (changes.types ?? selectedTypes).length > 0
            ? ((changes.types ?? selectedTypes) as BrowseInput['contentTypes'])
            : undefined,
        status:
          (changes.status ?? selectedStatus).length > 0
            ? ((changes.status ?? selectedStatus) as BrowseInput['status'])
            : undefined,
        businessType: (changes.business !== undefined
          ? changes.business
          : selectedBusinessType) as BrowseInput['businessType'],
        subjectCodes:
          (changes.categories ?? selectedCategories).length > 0
            ? (changes.categories ?? selectedCategories)
            : undefined,
        dateFrom,
        dateTo,
        page: 1, // Always page 1 when filters change
        limit,
        sortBy,
      }
    },
    [
      searchParams,
      selectedTypes,
      selectedStatus,
      selectedBusinessType,
      selectedCategories,
      dateFrom,
      dateTo,
    ]
  )

  // Prefetch on hover for instant filter changes
  const prefetchTypeToggle = useCallback(
    (value: string) => {
      const newTypes = selectedTypes.includes(value)
        ? selectedTypes.filter((v) => v !== value)
        : [...selectedTypes, value]
      prefetchBrowse(buildPrefetchInput({ types: newTypes }))
    },
    [selectedTypes, buildPrefetchInput]
  )

  const prefetchStatusToggle = useCallback(
    (value: string) => {
      const newStatus = selectedStatus.includes(value)
        ? selectedStatus.filter((v) => v !== value)
        : [...selectedStatus, value]
      prefetchBrowse(buildPrefetchInput({ status: newStatus }))
    },
    [selectedStatus, buildPrefetchInput]
  )

  const prefetchBusinessType = useCallback(
    (value: string) => {
      const newBusiness = selectedBusinessType === value ? undefined : value
      prefetchBrowse(buildPrefetchInput({ business: newBusiness }))
    },
    [selectedBusinessType, buildPrefetchInput]
  )

  const prefetchCategoryToggle = useCallback(
    (value: string) => {
      const newCategories = selectedCategories.includes(value)
        ? selectedCategories.filter((v) => v !== value)
        : [...selectedCategories, value]
      prefetchBrowse(buildPrefetchInput({ categories: newCategories }))
    },
    [selectedCategories, buildPrefetchInput]
  )

  return (
    <div
      className={cn(
        'space-y-6 transition-opacity duration-150',
        isPending && 'pointer-events-none opacity-60'
      )}
    >
      {/* Fixed header row - always reserves space (hidden in mobile drawer) */}
      {!hideHeader && (
        <div className="flex h-5 items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            Filter
            {isPending && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </span>
          <button
            onClick={clearAllFilters}
            disabled={isPending}
            className={cn(
              'flex items-center text-xs text-primary hover:text-primary/80',
              !hasFilters && 'invisible'
            )}
          >
            <X className="mr-1 h-3 w-3" />
            Rensa alla
          </button>
        </div>
      )}

      {/* Content Type Filter */}
      {showContentTypeFilter && (
        <FilterSection title="Dokumenttyp">
          <div className="space-y-2">
            {getContentTypes().map((type) => (
              <label
                key={type.value}
                className="flex cursor-pointer items-center gap-2"
                onMouseEnter={() => prefetchTypeToggle(type.value)}
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type.value)}
                  onChange={() =>
                    toggleArrayFilter('types', type.value, selectedTypes)
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    type.color
                  )}
                >
                  {type.label}
                </span>
              </label>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Business Type Filter */}
      <FilterSection title="Målgrupp">
        <div className="space-y-2">
          {BUSINESS_TYPES.map((type) => (
            <label
              key={type.value}
              className="flex cursor-pointer items-center gap-2"
              onMouseEnter={() => prefetchBusinessType(type.value)}
            >
              <input
                type="radio"
                name="businessType"
                checked={selectedBusinessType === type.value}
                onChange={() =>
                  updateFilters(
                    'business',
                    selectedBusinessType === type.value ? undefined : type.value
                  )
                }
                className="h-4 w-4 border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">{type.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Category Filter */}
      <FilterSection title="Kategori">
        <div className="space-y-2">
          {CATEGORIES.map((category) => (
            <label
              key={category.value}
              className="flex cursor-pointer items-center gap-2"
              onMouseEnter={() => prefetchCategoryToggle(category.value)}
            >
              <input
                type="checkbox"
                checked={selectedCategories.includes(category.value)}
                onChange={() =>
                  toggleArrayFilter(
                    'categories',
                    category.value,
                    selectedCategories
                  )
                }
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">{category.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Status Filter */}
      <FilterSection title="Status">
        <div className="space-y-2">
          {STATUS_OPTIONS.map((status) => (
            <label
              key={status.value}
              className="flex cursor-pointer items-center gap-2"
              onMouseEnter={() => prefetchStatusToggle(status.value)}
            >
              <input
                type="checkbox"
                checked={selectedStatus.includes(status.value)}
                onChange={() =>
                  toggleArrayFilter('status', status.value, selectedStatus)
                }
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">{status.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Date Range Filter */}
      <FilterSection title="Datum">
        <div className="space-y-3">
          <div>
            <label
              htmlFor="date-from"
              className="mb-1 block text-xs text-muted-foreground"
            >
              Från
            </label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom ?? ''}
              onChange={(e) =>
                updateFilters('from', e.target.value || undefined)
              }
              className="h-9"
            />
          </div>
          <div>
            <label
              htmlFor="date-to"
              className="mb-1 block text-xs text-muted-foreground"
            >
              Till
            </label>
            <Input
              id="date-to"
              type="date"
              value={dateTo ?? ''}
              onChange={(e) => updateFilters('to', e.target.value || undefined)}
              className="h-9"
            />
          </div>
        </div>
      </FilterSection>
    </div>
  )
}

function FilterSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-foreground">{title}</h3>
      {children}
    </div>
  )
}
