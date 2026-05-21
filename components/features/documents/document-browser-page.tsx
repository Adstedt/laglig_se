'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
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
import { FilePlus, Upload, FileText, Archive, Loader2 } from 'lucide-react'
import {
  WorkspaceViewTabs,
  WorkspaceViewTabsList,
  WorkspaceViewTabsTrigger,
} from '@/components/ui/workspace-view-tabs'
import { PageHeader } from '@/components/ui/page-header'
import { TableToolbar } from '@/components/ui/table-toolbar'
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

  // Tab state
  const [activeTab, setActiveTab] = useState<'aktiva' | 'arkiverade'>(
    (searchParams.get('tab') as 'aktiva' | 'arkiverade') ?? 'aktiva'
  )

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)

  // Data state — allDocuments holds the raw fetch, documents is tab-filtered
  const [allDocuments, setAllDocuments] = useState<DocumentItem[]>([])
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
      if (activeTab === 'arkiverade') params.set('tab', 'arkiverade')
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
          setAllDocuments((prev) => [...prev, ...items])
        } else {
          setAllDocuments(items)
        }
        setHasMore(data.hasMore)
        setNextCursor(data.nextCursor)
      }

      setLoading(false)
      setLoadingMore(false)
    },
    [filters, sortBy, sortOrder]
  )

  // Derive documents from tab
  const documents =
    activeTab === 'arkiverade'
      ? allDocuments.filter((d) => d.status === 'ARCHIVED')
      : allDocuments.filter((d) => d.status !== 'ARCHIVED')

  // Re-fetch on filter/sort change
  useEffect(() => {
    fetchDocuments()
    syncToUrl(filters, sortBy, sortOrder)
  }, [fetchDocuments, syncToUrl, filters, sortBy, sortOrder])

  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value as 'aktiva' | 'arkiverade')
      const params = new URLSearchParams(searchParams.toString())
      if (value === 'aktiva') {
        params.delete('tab')
      } else {
        params.set('tab', value)
      }
      const qs = params.toString()
      router.replace(`/workspace/styrdokument${qs ? `?${qs}` : ''}`, {
        scroll: false,
      })
    },
    [router, searchParams]
  )

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
      {/* Story 22.3 — PageHeader. `Importera` (secondaryAction) renders to
          the LEFT of `Nytt dokument` (primaryAction) per the slot order. */}
      <PageHeader
        title="Styrdokument"
        subtitle="Policyer, rutiner och instruktioner med versionshistorik"
        secondaryActions={
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importera
          </Button>
        }
        primaryAction={
          <Button onClick={() => setCreateOpen(true)}>
            <FilePlus className="mr-2 h-4 w-4" />
            Nytt dokument
          </Button>
        }
      />

      {/* Story 22.3 — TableToolbar wraps the existing tabs + filter dropdowns.
          Tabs stay shadcn (view-switcher), DocumentFilterControls flows into
          the `filters` slot. */}
      <TableToolbar
        views={
          <WorkspaceViewTabs value={activeTab} onValueChange={handleTabChange}>
            <WorkspaceViewTabsList>
              <WorkspaceViewTabsTrigger value="aktiva">
                <FileText className="h-4 w-4" />
                Aktiva
              </WorkspaceViewTabsTrigger>
              <WorkspaceViewTabsTrigger value="arkiverade">
                <Archive className="h-4 w-4" />
                Arkiverade
              </WorkspaceViewTabsTrigger>
            </WorkspaceViewTabsList>
          </WorkspaceViewTabs>
        }
        filters={
          <DocumentFilterControls
            filters={filters}
            onFiltersChange={handleFiltersChange}
            hideStatusFilter={activeTab === 'arkiverade'}
            excludeStatuses={activeTab === 'aktiva' ? ['ARCHIVED'] : undefined}
          />
        }
      />

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        activeTab === 'arkiverade' ? (
          <EmptyState
            icon={
              <EmptyState.Icon>
                <Archive className="h-8 w-8 text-muted-foreground" />
              </EmptyState.Icon>
            }
            title="Inga arkiverade dokument"
            description="Dokument som arkiveras hamnar här."
          />
        ) : filters.search ||
          filters.types.length > 0 ||
          filters.statuses.length > 0 ? (
          <EmptyState
            icon={
              <EmptyState.Icon>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </EmptyState.Icon>
            }
            title="Inga dokument hittades"
            description="Ändra dina filter för att hitta dokument."
          />
        ) : (
          <EmptyState
            icon={
              <EmptyState.Icon>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </EmptyState.Icon>
            }
            title="Inga styrdokument ännu"
            description="Skapa ditt första styrdokument från grunden eller importera en befintlig version."
            action={
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
            }
          />
        )
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
