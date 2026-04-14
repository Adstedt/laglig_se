'use client'

/**
 * Story 17.18: Linked Artifacts Panel
 * Item-first, deduplicated view of every file/styrdokument linked to this LawListItem
 * across all five pathways (direct, kravpunkter evidence, task attachments).
 */

import { useEffect, useMemo, useState, useRef } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Paperclip,
  FileText,
  Upload,
  Plus,
  Download,
  X,
  Loader2,
  Link2,
  ClipboardCheck,
  ListTodo,
  ExternalLink,
} from 'lucide-react'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import {
  getLinkedArtifactsForListItem,
  type LinkedArtifact,
  type LinkedArtifactsResult,
} from '@/app/actions/linked-artifacts'
import {
  uploadFileAndLinkToListItem,
  linkFilesToListItem,
  unlinkFile,
  getFileDownloadUrl,
} from '@/app/actions/files'
import {
  linkDocumentToListItem,
  unlinkDocumentFromListItem,
} from '@/app/actions/documents'
import { FilePickerModal } from '@/components/features/files/file-picker-modal'
import { DocumentPickerModal } from '@/components/features/documents/document-picker-modal'
import { DocumentStatusBadge } from '@/components/features/documents/document-status-badge'
import { DOCUMENT_TYPE_LABELS } from '@/components/features/documents/document-type-labels'
import {
  ACCEPTED_TYPES,
  MAX_FILE_SIZE,
} from '@/components/features/files/file-dropzone'

// ============================================================================
// Types
// ============================================================================

type FilterValue = 'all' | 'bevis' | 'direct' | 'tasks'

interface LinkedArtifactsPanelProps {
  listItemId: string
  readOnly?: boolean | undefined
}

// ============================================================================
// Helpers
// ============================================================================

function applyFilter(
  artifacts: LinkedArtifact[],
  filter: FilterValue,
  showFiles: boolean,
  showDocuments: boolean
): LinkedArtifact[] {
  return artifacts.filter((a) => {
    if (a.kind === 'file' && !showFiles) return false
    if (a.kind === 'document' && !showDocuments) return false
    switch (filter) {
      case 'all':
        return true
      case 'bevis':
        return a.requirements.length > 0
      case 'direct':
        return a.directLink
      case 'tasks':
        return a.tasks.length > 0
    }
  })
}

// ============================================================================
// Main panel
// ============================================================================

export function LinkedArtifactsPanel({
  listItemId,
  readOnly = false,
}: LinkedArtifactsPanelProps) {
  const swrKey = `linked-artifacts:${listItemId}`
  const { data, isLoading } = useSWR<LinkedArtifactsResult>(
    swrKey,
    async () => {
      const result = await getLinkedArtifactsForListItem(listItemId)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta länkade artefakter')
      }
      return result.data
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  )

  const artifacts = useMemo(() => data?.artifacts ?? [], [data])
  const totalCount = artifacts.length

  const [filter, setFilter] = useState<FilterValue>('all')
  const [showFiles, setShowFiles] = useState(true)
  const [showDocuments, setShowDocuments] = useState(true)
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [showDocPicker, setShowDocPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(
    () => applyFilter(artifacts, filter, showFiles, showDocuments),
    [artifacts, filter, showFiles, showDocuments]
  )

  // Listen for "highlight me" event from the right-panel health widget.
  // Two-second amber ring fades out so the user can see where they landed
  // even when the panel was already in view.
  const [highlighted, setHighlighted] = useState(false)
  useEffect(() => {
    const handler = () => {
      setHighlighted(true)
      const t = window.setTimeout(() => setHighlighted(false), 1500)
      return () => window.clearTimeout(t)
    }
    window.addEventListener('laglig:focus-linked-artifacts', handler)
    return () =>
      window.removeEventListener('laglig:focus-linked-artifacts', handler)
  }, [])

  const hasAnyArtifacts = totalCount > 0
  const hasFilterResults = filtered.length > 0
  const filtersActive = filter !== 'all' || !showFiles || !showDocuments

  const refresh = () => globalMutate(swrKey)

  // ---------------- Mutations ----------------

  const handleUpload = async (files: File[]) => {
    if (!files.length) return
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} är för stor (max 25MB)`)
        return
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`${file.name} — filtypen stöds inte`)
        return
      }
    }
    let uploaded = 0
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', 'BEVIS')
      const result = await uploadFileAndLinkToListItem(formData, listItemId)
      if (result.success) uploaded++
      else toast.error(`Kunde inte ladda upp ${file.name}: ${result.error}`)
    }
    if (uploaded > 0) {
      toast.success(
        uploaded === 1 ? 'Filen laddades upp' : `${uploaded} filer laddades upp`
      )
      refresh()
    }
  }

  const handlePickFiles = async (fileIds: string[]) => {
    if (!fileIds.length) return
    const result = await linkFilesToListItem(fileIds, listItemId)
    if (result.success) {
      toast.success(
        fileIds.length === 1
          ? 'Filen länkad'
          : `${fileIds.length} filer länkade`
      )
      refresh()
    } else {
      toast.error(result.error || 'Kunde inte länka filer')
    }
  }

  const handlePickDocuments = async (docIds: string[]) => {
    if (!docIds.length) return
    let linked = 0
    for (const id of docIds) {
      const result = await linkDocumentToListItem(id, listItemId)
      if (result.success) linked++
    }
    if (linked > 0) {
      toast.success(
        linked === 1 ? 'Dokumentet länkat' : `${linked} dokument länkade`
      )
      refresh()
    } else {
      toast.error('Kunde inte länka dokument')
    }
  }

  const handleUnlinkFile = async (fileId: string) => {
    const result = await unlinkFile(fileId, 'list_item', listItemId)
    if (result.success) {
      toast.success('Länken togs bort')
      refresh()
    } else {
      toast.error(result.error || 'Kunde inte ta bort länk')
    }
  }

  const handleUnlinkDocument = async (docId: string) => {
    const result = await unlinkDocumentFromListItem(docId, listItemId)
    if (result.success) {
      toast.success('Länken togs bort')
      refresh()
    } else {
      toast.error(result.error || 'Kunde inte ta bort länk')
    }
  }

  const linkedFileIds = artifacts
    .filter((a) => a.kind === 'file')
    .map((a) => a.id)
  const linkedDocIds = artifacts
    .filter((a) => a.kind === 'document')
    .map((a) => a.id)

  // ---------------- Render ----------------

  return (
    <AccordionItem
      value="linked-artifacts"
      id="linked-artifacts-accordion"
      className={cn(
        'border rounded-lg border-border/60 scroll-mt-4 transition-shadow duration-500',
        highlighted && 'ring-2 ring-amber-400/70 shadow-lg'
      )}
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 rounded-t-lg data-[state=closed]:rounded-lg">
        <div className="flex items-center gap-2 text-base font-semibold text-foreground flex-1">
          <Paperclip className="h-4 w-4" />
          <span>Länkade filer & dokument</span>
          {totalCount > 0 && (
            <span className="ml-auto mr-2 text-xs text-muted-foreground tabular-nums font-normal">
              {totalCount}
            </span>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 space-y-3">
        {/* Hidden file input for upload trigger */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? [])
            await handleUpload(files)
            if (fileInputRef.current) fileInputRef.current.value = ''
          }}
        />

        {/* Filter + type toggles (only if anything to filter) */}
        {hasAnyArtifacts && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ToggleGroup
              type="single"
              value={filter}
              onValueChange={(v) => v && setFilter(v as FilterValue)}
              size="sm"
              className="bg-muted/40 p-0.5 rounded-md"
            >
              <ToggleGroupItem value="all" className="text-xs h-7 px-2.5">
                Alla
              </ToggleGroupItem>
              <ToggleGroupItem value="bevis" className="text-xs h-7 px-2.5">
                Bevis
              </ToggleGroupItem>
              <ToggleGroupItem value="direct" className="text-xs h-7 px-2.5">
                Direktlänkade
              </ToggleGroupItem>
              <ToggleGroupItem value="tasks" className="text-xs h-7 px-2.5">
                Via uppgifter
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <label
                htmlFor="linked-artifacts-filter-files"
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <Checkbox
                  id="linked-artifacts-filter-files"
                  checked={showFiles}
                  onCheckedChange={(v) => setShowFiles(Boolean(v))}
                  className="h-3.5 w-3.5"
                />
                Filer
              </label>
              <label
                htmlFor="linked-artifacts-filter-documents"
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <Checkbox
                  id="linked-artifacts-filter-documents"
                  checked={showDocuments}
                  onCheckedChange={(v) => setShowDocuments(Boolean(v))}
                  className="h-3.5 w-3.5"
                />
                Styrdokument
              </label>
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !hasAnyArtifacts ? (
          <EmptyAll />
        ) : !hasFilterResults ? (
          <EmptyFilter
            onReset={() => {
              setFilter('all')
              setShowFiles(true)
              setShowDocuments(true)
            }}
            filtersActive={filtersActive}
          />
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((a) => (
              <ArtifactRow
                key={`${a.kind}:${a.id}`}
                artifact={a}
                readOnly={readOnly}
                onUnlinkFile={() => handleUnlinkFile(a.id)}
                onUnlinkDocument={() => handleUnlinkDocument(a.id)}
              />
            ))}
          </ul>
        )}

        {/* Footer action bar — ghost split, matches TasksAccordion pattern */}
        {!readOnly && (
          <div className="flex gap-2 pt-3 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-9 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              Ladda upp fil
            </Button>
            <div className="w-px bg-border/50" />
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-9 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              onClick={() => setShowFilePicker(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Länka fil
            </Button>
            <div className="w-px bg-border/50" />
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-9 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              onClick={() => setShowDocPicker(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Länka styrdokument
            </Button>
          </div>
        )}

        <FilePickerModal
          open={showFilePicker}
          onOpenChange={setShowFilePicker}
          onSelect={handlePickFiles}
          excludeIds={linkedFileIds}
          onUploadNew={() => {
            setShowFilePicker(false)
            fileInputRef.current?.click()
          }}
        />
        <DocumentPickerModal
          open={showDocPicker}
          onOpenChange={setShowDocPicker}
          onSelect={handlePickDocuments}
          excludeIds={linkedDocIds}
        />
      </AccordionContent>
    </AccordionItem>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function EmptyAll() {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
        <Paperclip className="h-5 w-5 text-muted-foreground/50" />
      </div>
      <p className="text-sm text-muted-foreground">
        Inga länkade filer eller dokument
      </p>
      <p className="text-xs text-muted-foreground/60 mt-1">
        Ladda upp eller länka något för att komma igång
      </p>
    </div>
  )
}

function EmptyFilter({
  onReset,
  filtersActive,
}: {
  onReset: () => void
  filtersActive: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-sm text-muted-foreground">Inga matchande artefakter</p>
      {filtersActive && (
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-primary hover:underline mt-2"
        >
          Återställ filter
        </button>
      )}
    </div>
  )
}

interface ArtifactRowProps {
  artifact: LinkedArtifact
  readOnly: boolean
  onUnlinkFile: () => void
  onUnlinkDocument: () => void
}

function ArtifactRow({
  artifact,
  readOnly,
  onUnlinkFile,
  onUnlinkDocument,
}: ArtifactRowProps) {
  const isFile = artifact.kind === 'file'
  const canUnlink = artifact.directLink && !readOnly
  const indirectOnly = !artifact.directLink

  return (
    <li
      className={cn(
        'flex items-center gap-2.5 py-2 px-2.5 rounded-md transition-colors group',
        'hover:bg-muted/50'
      )}
    >
      {/* Icon */}
      <span
        className={cn(
          'shrink-0',
          isFile ? 'text-muted-foreground' : 'text-primary'
        )}
      >
        {isFile ? (
          <Paperclip className="h-4 w-4" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
      </span>

      {/* Primary + secondary metadata */}
      <div className="flex-1 min-w-0">
        {isFile ? (
          <FilePrimary artifact={artifact} />
        ) : (
          <DocumentPrimary artifact={artifact} />
        )}
      </div>

      {/* Back-reference chips — consolidated icon+count */}
      <BackRefChips artifact={artifact} />

      {/* Row actions — fixed column so chips don't shift */}
      <div className="flex items-center gap-0.5 shrink-0 w-16 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        {isFile && <FileActions artifact={artifact} />}
        {!isFile && <DocumentOpenLink artifact={artifact} />}
        {canUnlink && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={isFile ? onUnlinkFile : onUnlinkDocument}
            aria-label="Ta bort länk"
            title="Ta bort direktlänken"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        {indirectOnly && !readOnly && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 opacity-50 cursor-not-allowed"
                  disabled
                  aria-label="Kan inte tas bort härifrån"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Länkad indirekt — ta bort länken från kravpunkten eller
                uppgiften istället.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </li>
  )
}

function BackRefChips({ artifact }: { artifact: LinkedArtifact }) {
  const reqCount = artifact.requirements.length
  const taskCount = artifact.tasks.length

  if (!artifact.directLink && reqCount === 0 && taskCount === 0) return null

  return (
    <TooltipProvider delayDuration={200}>
      <div className="hidden md:flex items-center gap-1 shrink-0 w-24 justify-start">
        {artifact.directLink && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                aria-label="Direktlänkad"
                className="h-5 px-1.5 font-normal cursor-default"
              >
                <Link2 className="h-3 w-3" />
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Direktlänkad till denna lag</TooltipContent>
          </Tooltip>
        )}
        {reqCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                aria-label={`Bevis för ${reqCount} ${reqCount === 1 ? 'kravpunkt' : 'kravpunkter'}`}
                className="h-5 px-1.5 gap-1 font-normal tabular-nums cursor-default"
              >
                <ClipboardCheck className="h-3 w-3" />
                {reqCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-xs font-medium mb-1">
                Bevis för {reqCount === 1 ? 'kravpunkt' : 'kravpunkter'}:
              </div>
              <ul className="text-xs space-y-0.5">
                {artifact.requirements.map((r) => (
                  <li key={r.id}>· {r.text}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        )}
        {taskCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                aria-label={`Bifogad till ${taskCount} ${taskCount === 1 ? 'uppgift' : 'uppgifter'}`}
                className="h-5 px-1.5 gap-1 font-normal tabular-nums cursor-default"
              >
                <ListTodo className="h-3 w-3" />
                {taskCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-xs font-medium mb-1">
                Bifogad till {taskCount === 1 ? 'uppgift' : 'uppgifter'}:
              </div>
              <ul className="text-xs space-y-0.5">
                {artifact.tasks.map((t) => (
                  <li key={t.id}>· {t.title}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}

function FilePrimary({ artifact }: { artifact: LinkedArtifact }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-sm truncate">{artifact.filename}</span>
    </div>
  )
}

function DocumentPrimary({ artifact }: { artifact: LinkedArtifact }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-sm truncate">{artifact.title}</span>
      {artifact.documentType && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
          {DOCUMENT_TYPE_LABELS[artifact.documentType] ?? artifact.documentType}
        </Badge>
      )}
      {artifact.status && (
        <DocumentStatusBadge
          status={artifact.status}
          className="text-[10px] px-1.5 py-0 shrink-0"
        />
      )}
      {typeof artifact.versionNumber === 'number' && (
        <span className="text-xs text-muted-foreground shrink-0">
          v{artifact.versionNumber}
        </span>
      )}
    </div>
  )
}

function FileActions({ artifact }: { artifact: LinkedArtifact }) {
  const [downloading, setDownloading] = useState(false)
  const handleDownload = async () => {
    setDownloading(true)
    try {
      const result = await getFileDownloadUrl(artifact.id)
      if (result.success && result.data?.url) {
        window.open(result.data.url, '_blank')
      } else {
        toast.error(result.error || 'Kunde inte hämta nedladdningslänk')
      }
    } finally {
      setDownloading(false)
    }
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0"
      onClick={handleDownload}
      disabled={downloading}
      aria-label="Ladda ner"
    >
      {downloading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
    </Button>
  )
}

function DocumentOpenLink({ artifact }: { artifact: LinkedArtifact }) {
  return (
    <Link
      href={`/workspace/styrdokument/${artifact.id}/edit`}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
      aria-label="Öppna dokument"
      title="Öppna dokument"
    >
      <ExternalLink className="h-3.5 w-3.5" />
    </Link>
  )
}
