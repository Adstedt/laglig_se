'use client'

/**
 * Story 4.11: Add Document Modal
 * Search and browse legal documents to add to a list
 *
 * UX Design Principles:
 * - Fixed modal height for consistent experience
 * - Internal scrolling for results
 * - Low cognitive load with clear visual hierarchy
 * - Result counts for user feedback
 */

import { useState, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search,
  Plus,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Scale,
} from 'lucide-react'
import {
  searchLegalDocuments,
  type SearchResult,
} from '@/app/actions/document-list'
import { browseDocumentsAction } from '@/app/actions/browse'
import {
  getContentTypeLabel,
  getContentTypeBadgeColor,
  getContentTypeIcon,
} from '@/lib/utils/content-type'
import { SearchResultsSkeleton } from './document-list-skeleton'
import { useDebouncedCallback } from 'use-debounce'
import { cn } from '@/lib/utils'
import type { ContentType } from '@prisma/client'

// Story 4.14: Document info for optimistic updates
export interface DocumentInfoForAdd {
  id: string
  title: string
  documentNumber: string
  contentType: ContentType
  slug: string
  summary?: string | null
}

interface AddDocumentModalProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  listId: string | null
  onAddDocument: (
    _documentId: string,
    _documentInfo: DocumentInfoForAdd
  ) => Promise<boolean>
}

// Browse categories with their content types
const BROWSE_CATEGORIES = [
  { id: 'laws', label: 'Lagar', types: ['SFS_LAW'] as ContentType[] },
  {
    id: 'amendments',
    label: 'Ändringar',
    types: ['SFS_AMENDMENT'] as ContentType[],
  },
  {
    id: 'courtCases',
    label: 'Rättsfall',
    types: [
      'COURT_CASE_HD',
      'COURT_CASE_HFD',
      'COURT_CASE_AD',
      'COURT_CASE_HOVR',
      'COURT_CASE_MOD',
      'COURT_CASE_MIG',
    ] as ContentType[],
  },
  {
    id: 'euDocs',
    label: 'EU-rätt',
    types: ['EU_REGULATION', 'EU_DIRECTIVE'] as ContentType[],
  },
  {
    id: 'agencyRegs',
    label: 'Föreskrifter',
    types: ['AGENCY_REGULATION'] as ContentType[],
  },
]

// Fixed heights for consistent modal sizing across tabs
const HEADER_HEIGHT = 'h-[56px]' // Fixed header height for search bar / category buttons
const SCROLL_HEIGHT = 'h-[340px]' // Fixed scroll area height for results
const FOOTER_HEIGHT = 'h-[44px]' // Fixed footer height for pagination / info

export function AddDocumentModal({
  open,
  onOpenChange,
  listId,
  onAddDocument,
}: AddDocumentModalProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'browse'>('search')

  // Search state
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [isSearching, setIsSearching] = useState(false)

  // Browse state
  const [browseCategory, setBrowseCategory] = useState<string>('laws')
  const [browseResults, setBrowseResults] = useState<SearchResult[]>([])
  const [isBrowsing, setIsBrowsing] = useState(false)
  const [browsePage, setBrowsePage] = useState(1)
  const [browseTotal, setBrowseTotal] = useState(0)
  const browseLimit = 8

  // Shared state
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setSearchResults([])
      setSearchTotal(0)
      setBrowseResults([])
      setAddedIds(new Set())
      setError(null)
      setActiveTab('search')
      setBrowsePage(1)
    }
  }, [open])

  // Load browse results when tab changes or category changes
  useEffect(() => {
    if (activeTab === 'browse' && listId) {
      loadBrowseResults()
    }
  }, [activeTab, browseCategory, browsePage, listId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  const debouncedSearch = useDebouncedCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !listId) {
      setSearchResults([])
      setSearchTotal(0)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    setError(null)

    try {
      const result = await searchLegalDocuments({
        query: searchQuery,
        excludeListId: listId,
        limit: 20,
        offset: 0,
      })

      if (result.success && result.data) {
        setSearchResults(result.data.results)
        setSearchTotal(result.data.total)
      } else {
        setError(result.error ?? 'Sökningen misslyckades')
        setSearchResults([])
        setSearchTotal(0)
      }
    } catch (err) {
      console.error('Search error:', err)
      setError('Något gick fel')
      setSearchResults([])
      setSearchTotal(0)
    } finally {
      setIsSearching(false)
    }
  }, 300)

  // Load browse results
  const loadBrowseResults = async () => {
    if (!listId) return

    setIsBrowsing(true)
    setError(null)

    const category = BROWSE_CATEGORIES.find((c) => c.id === browseCategory)
    if (!category) return

    try {
      const result = await browseDocumentsAction({
        contentTypes: category.types,
        page: browsePage,
        limit: browseLimit,
        sortBy: 'title',
      })

      if (result.success) {
        const transformed: SearchResult[] = result.results.map((doc) => ({
          id: doc.id,
          title: doc.title,
          documentNumber: doc.documentNumber,
          contentType: doc.contentType as ContentType,
          slug: doc.slug,
          summary: doc.summary,
          alreadyInList: addedIds.has(doc.id),
        }))
        setBrowseResults(transformed)
        setBrowseTotal(result.total)
      } else {
        setError(result.error ?? 'Kunde inte ladda dokument')
        setBrowseResults([])
      }
    } catch (err) {
      console.error('Browse error:', err)
      setError('Något gick fel')
      setBrowseResults([])
    } finally {
      setIsBrowsing(false)
    }
  }

  // Handle search input change
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setQuery(value)
      if (value.trim()) {
        setIsSearching(true)
        debouncedSearch(value)
      } else {
        setSearchResults([])
        setSearchTotal(0)
      }
    },
    [debouncedSearch]
  )

  // Handle add document (Story 4.14: Pass document info for optimistic update)
  const handleAdd = async (document: SearchResult) => {
    if (!listId || document.alreadyInList || addedIds.has(document.id)) return

    setAddingId(document.id)

    try {
      // Story 4.14: Pass document info for true optimistic update
      const documentInfo: DocumentInfoForAdd = {
        id: document.id,
        title: document.title,
        documentNumber: document.documentNumber,
        contentType: document.contentType,
        slug: document.slug,
        summary: document.summary,
      }
      const success = await onAddDocument(document.id, documentInfo)

      if (success) {
        setAddedIds((prev) => new Set([...prev, document.id]))
      }
    } catch (err) {
      console.error('Add error:', err)
    }

    setAddingId(null)
  }

  // Pagination helpers
  const totalPages = Math.ceil(browseTotal / browseLimit)
  const canGoPrev = browsePage > 1
  const canGoNext = browsePage < totalPages

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Lägg till dokument</DialogTitle>
          <DialogDescription>
            Sök eller bläddra bland lagar, föreskrifter, rättsfall och
            EU-dokument.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'search' | 'browse')}
        >
          <div className="px-6 pb-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search" className="gap-2">
                <Search className="h-4 w-4" />
                Sök
              </TabsTrigger>
              <TabsTrigger value="browse" className="gap-2">
                <Scale className="h-4 w-4" />
                Bläddra
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Search Tab */}
          <TabsContent value="search" className="mt-0 focus-visible:ring-0">
            {/* Header - fixed height */}
            <div
              className={cn(
                'px-6 flex items-center border-b bg-muted/30',
                HEADER_HEIGHT
              )}
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Sök på titel eller SFS-nummer..."
                  value={query}
                  onChange={handleSearchChange}
                  className="pl-10 bg-background"
                />
              </div>
            </div>

            {/* Results area - fixed height */}
            <ScrollArea className={SCROLL_HEIGHT}>
              <div className="p-4">
                {error && activeTab === 'search' ? (
                  <EmptyState icon={Search} title="Fel" description={error} />
                ) : isSearching ? (
                  <SearchResultsSkeleton />
                ) : query && searchResults.length === 0 ? (
                  <EmptyState
                    icon={Search}
                    title="Inga resultat"
                    description={`Inga dokument matchade "${query}". Prova ett annat sökord.`}
                  />
                ) : searchResults.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {searchResults.map((doc) => (
                      <DocumentResultItem
                        key={doc.id}
                        document={doc}
                        onAdd={() => handleAdd(doc)}
                        isAdding={addingId === doc.id}
                        isAdded={addedIds.has(doc.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={FileText}
                    title="Sök efter dokument"
                    description="Skriv ett sökord för att hitta lagar, föreskrifter, rättsfall eller EU-dokument."
                  />
                )}
              </div>
            </ScrollArea>

            {/* Footer - fixed height */}
            <div
              className={cn(
                'px-6 flex items-center border-t bg-muted/30',
                FOOTER_HEIGHT
              )}
            >
              {query && !isSearching && (
                <p className="text-sm text-muted-foreground">
                  {searchTotal > 0
                    ? `${searchTotal} ${searchTotal === 1 ? 'resultat' : 'resultat'} för "${query}"`
                    : `Inga resultat för "${query}"`}
                </p>
              )}
            </div>
          </TabsContent>

          {/* Browse Tab */}
          <TabsContent value="browse" className="mt-0 focus-visible:ring-0">
            {/* Header - fixed height with category buttons */}
            <div
              className={cn(
                'px-6 flex items-center border-b bg-muted/30',
                HEADER_HEIGHT
              )}
            >
              <div className="flex flex-wrap gap-2">
                {BROWSE_CATEGORIES.map((category) => (
                  <Button
                    key={category.id}
                    variant={
                      browseCategory === category.id ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={() => {
                      setBrowseCategory(category.id)
                      setBrowsePage(1)
                    }}
                    className="h-8"
                  >
                    {category.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Results area - fixed height */}
            <ScrollArea className={SCROLL_HEIGHT}>
              <div className="p-4">
                {error && activeTab === 'browse' ? (
                  <EmptyState icon={FileText} title="Fel" description={error} />
                ) : isBrowsing ? (
                  <SearchResultsSkeleton />
                ) : browseResults.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="Inga dokument"
                    description="Det finns inga dokument i denna kategori."
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {browseResults.map((doc) => (
                      <DocumentResultItem
                        key={doc.id}
                        document={doc}
                        onAdd={() => handleAdd(doc)}
                        isAdding={addingId === doc.id}
                        isAdded={addedIds.has(doc.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Footer - fixed height */}
            <div
              className={cn(
                'px-6 flex items-center justify-between border-t bg-muted/30',
                FOOTER_HEIGHT
              )}
            >
              <p className="text-sm text-muted-foreground">
                {browseTotal > 0
                  ? `${browseTotal.toLocaleString('sv-SE')} dokument i kategorin`
                  : 'Laddar...'}
              </p>
              {browseTotal > browseLimit && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBrowsePage((p) => p - 1)}
                    disabled={!canGoPrev || isBrowsing}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-2 min-w-[60px] text-center">
                    {browsePage} / {totalPages.toLocaleString('sv-SE')}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBrowsePage((p) => p + 1)}
                    disabled={!canGoNext || isBrowsing}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// Empty state component for consistent messaging
function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-medium text-sm">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-[280px]">
        {description}
      </p>
    </div>
  )
}

// Document result item component
function DocumentResultItem({
  document,
  onAdd,
  isAdding,
  isAdded,
}: {
  document: SearchResult
  onAdd: () => void
  isAdding: boolean
  isAdded: boolean
}) {
  const TypeIcon = getContentTypeIcon(document.contentType)
  const isDisabled = document.alreadyInList || isAdded || isAdding

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors',
        isDisabled
          ? 'opacity-60 bg-muted/30'
          : 'hover:bg-muted/50 hover:border-muted-foreground/20'
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm leading-snug line-clamp-2">
          {document.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground font-mono">
            {document.documentNumber}
          </span>
          <Badge
            variant="secondary"
            className={cn(
              'text-xs flex items-center gap-1 shrink-0 h-5',
              getContentTypeBadgeColor(document.contentType)
            )}
          >
            <TypeIcon className="h-3 w-3" />
            {getContentTypeLabel(document.contentType)}
          </Badge>
        </div>
      </div>

      <Button
        size="sm"
        variant={isAdded || document.alreadyInList ? 'secondary' : 'default'}
        onClick={onAdd}
        disabled={isDisabled}
        className="shrink-0 h-8"
      >
        {isAdding ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isAdded || document.alreadyInList ? (
          <>
            <Check className="h-4 w-4 mr-1" />
            Tillagt
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-1" />
            Lägg till
          </>
        )}
      </Button>
    </div>
  )
}
