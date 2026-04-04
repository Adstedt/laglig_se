'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FilePlus, Upload, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getWorkspaceDocuments,
  updateDocumentStatus,
} from '@/app/actions/documents'
import { CreateDocumentDialog } from '@/components/features/documents/create-document-dialog'
import { ImportDocumentDialog } from '@/components/features/documents/import-document-dialog'
import {
  DocumentTable,
  type DocumentItem,
} from '@/components/features/documents/document-table'
import {
  DocumentFilterControls,
  type DocumentFilters,
} from '@/components/features/documents/document-filters'

type SortField = 'title' | 'updated_at' | 'created_at' | 'review_date'

export function DocumentBrowserPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)

  // Data state
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | undefined>()

  // Filter/sort state from URL params
  const [filters, setFilters] = useState<DocumentFilters>({
    search: searchParams.get('search') ?? '',
    types: searchParams.getAll('type'),
    statuses: searchParams.getAll('status'),
  })
  const [sortBy, setSortBy] = useState<SortField>(
    (searchParams.get('sortBy') as SortField) ?? 'updated_at'
  )
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('sortOrder') as 'asc' | 'desc') ?? 'desc'
  )

  // Sync filters to URL
  const syncToUrl = useCallback(
    (f: DocumentFilters, sb: SortField, so: 'asc' | 'desc') => {
      const params = new URLSearchParams()
      if (f.search) params.set('search', f.search)
      for (const t of f.types) params.append('type', t)
      for (const s of f.statuses) params.append('status', s)
      if (sb !== 'updated_at') params.set('sortBy', sb)
      if (so !== 'desc') params.set('sortOrder', so)
      const qs = params.toString()
      router.replace(`/workspace/styrdokument${qs ? `?${qs}` : ''}`, {
        scroll: false,
      })
    },
    [router]
  )

  // Fetch documents
  const fetchDocuments = useCallback(
    async (cursor?: string) => {
      const isLoadMore = !!cursor
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      // The server action accepts single type/status, but we filter client-side for multi-select
      // Pass first filter value to server, then filter remaining client-side
      const result = await getWorkspaceDocuments({
        search: filters.search || undefined,
        type:
          filters.types.length === 1 ? (filters.types[0] as never) : undefined,
        status:
          filters.statuses.length === 1
            ? (filters.statuses[0] as never)
            : undefined,
        sortBy,
        sortOrder,
        cursor,
        take: 25,
      })

      if (result.success && result.data) {
        const data = result.data as {
          items: DocumentItem[]
          hasMore: boolean
          nextCursor?: string
        }

        // Client-side multi-filter (server supports single type/status)
        let items = data.items
        if (filters.types.length > 1) {
          items = items.filter((d) => filters.types.includes(d.document_type))
        }
        if (filters.statuses.length > 1) {
          items = items.filter((d) => filters.statuses.includes(d.status))
        }

        if (isLoadMore) {
          setDocuments((prev) => [...prev, ...items])
        } else {
          setDocuments(items)
        }
        setHasMore(data.hasMore)
        setNextCursor(data.nextCursor)
      }

      setLoading(false)
      setLoadingMore(false)
    },
    [filters, sortBy, sortOrder]
  )

  // Re-fetch on filter/sort change
  useEffect(() => {
    fetchDocuments()
    syncToUrl(filters, sortBy, sortOrder)
  }, [fetchDocuments, syncToUrl, filters, sortBy, sortOrder])

  const handleFiltersChange = useCallback((newFilters: DocumentFilters) => {
    setFilters(newFilters)
    setNextCursor(undefined)
  }, [])

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortBy) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortBy(field)
        setSortOrder('asc')
      }
      setNextCursor(undefined)
    },
    [sortBy]
  )

  const handleLoadMore = useCallback(() => {
    if (nextCursor) {
      fetchDocuments(nextCursor)
    }
  }, [nextCursor, fetchDocuments])

  const handleArchive = useCallback(async () => {
    if (!archiveTarget) return
    setArchiving(true)
    const result = await updateDocumentStatus({
      documentId: archiveTarget,
      newStatus: 'ARCHIVED' as never,
      comment: 'Arkiverad från dokumentlistan',
    })
    setArchiving(false)
    setArchiveTarget(null)
    if (result.success) {
      toast.success('Dokument arkiverat')
      fetchDocuments()
    } else {
      toast.error(result.error ?? 'Kunde inte arkivera')
    }
  }, [archiveTarget, fetchDocuments])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Styrdokument</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Policyer, rutiner och instruktioner med versionshistorik
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importera
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <FilePlus className="mr-2 h-4 w-4" />
            Nytt dokument
          </Button>
        </div>
      </div>

      {/* Filters */}
      <DocumentFilterControls
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-medium mb-1">
            {filters.search ||
            filters.types.length > 0 ||
            filters.statuses.length > 0
              ? 'Inga dokument hittades'
              : 'Skapa ditt första dokument'}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {filters.search ||
            filters.types.length > 0 ||
            filters.statuses.length > 0
              ? 'Ändra dina filter för att hitta dokument.'
              : 'Kom igång genom att skapa ett nytt dokument eller importera ett befintligt.'}
          </p>
          {!(
            filters.search ||
            filters.types.length > 0 ||
            filters.statuses.length > 0
          ) && (
            <div className="flex gap-2">
              <Button onClick={() => setCreateOpen(true)}>
                <FilePlus className="mr-2 h-4 w-4" />
                Nytt dokument
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Importera
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <DocumentTable
            documents={documents}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onArchive={(id) => setArchiveTarget(id)}
          />
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Ladda fler
              </Button>
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <CreateDocumentDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ImportDocumentDialog open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arkivera dokument</AlertDialogTitle>
            <AlertDialogDescription>
              Vill du arkivera detta dokument? Arkiverade dokument kan inte
              redigeras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={archiving}>
              {archiving ? 'Arkiverar...' : 'Arkivera'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
