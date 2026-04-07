'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  getDocumentVersions,
  getDocumentVersionContent,
  type DocumentVersionEntry,
} from '@/app/actions/documents'
import { computeDiff, type DiffSegment } from '@/lib/utils/document-diff'
import { cn } from '@/lib/utils'

interface VersionDiffViewProps {
  documentId: string
  open: boolean
  onOpenChange: (_open: boolean) => void
  initialFromVersionId?: string | undefined
  initialToVersionId?: string | undefined
}

export function VersionDiffView({
  documentId,
  open,
  onOpenChange,
  initialFromVersionId,
  initialToVersionId,
}: VersionDiffViewProps) {
  const [versions, setVersions] = useState<DocumentVersionEntry[]>([])
  const [fromVersionId, setFromVersionId] = useState<string>(
    initialFromVersionId ?? ''
  )
  const [toVersionId, setToVersionId] = useState<string>(
    initialToVersionId ?? ''
  )
  const [diffSegments, setDiffSegments] = useState<DiffSegment[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingVersions, setLoadingVersions] = useState(false)

  // Fetch version list when dialog opens
  useEffect(() => {
    if (!open) return

    const fetchVersions = async () => {
      setLoadingVersions(true)
      const result = await getDocumentVersions(documentId)
      if (result.success && result.data) {
        setVersions(result.data)
      }
      setLoadingVersions(false)
    }
    fetchVersions()
  }, [open, documentId])

  // Update selectors when initial values change
  useEffect(() => {
    if (initialFromVersionId) setFromVersionId(initialFromVersionId)
    if (initialToVersionId) setToVersionId(initialToVersionId)
  }, [initialFromVersionId, initialToVersionId])

  // Compute diff when both versions are selected
  const computeVersionDiff = useCallback(async () => {
    if (!fromVersionId || !toVersionId || fromVersionId === toVersionId) {
      setDiffSegments([])
      return
    }

    setLoading(true)
    const [fromResult, toResult] = await Promise.all([
      getDocumentVersionContent(documentId, fromVersionId),
      getDocumentVersionContent(documentId, toVersionId),
    ])

    if (
      fromResult.success &&
      fromResult.data &&
      toResult.success &&
      toResult.data
    ) {
      const segments = computeDiff(
        fromResult.data.extracted_text,
        toResult.data.extracted_text
      )
      setDiffSegments(segments)
    }
    setLoading(false)
  }, [documentId, fromVersionId, toVersionId])

  useEffect(() => {
    if (open && fromVersionId && toVersionId) {
      computeVersionDiff()
    }
  }, [open, fromVersionId, toVersionId, computeVersionDiff])

  const fromVersion = versions.find((v) => v.id === fromVersionId)
  const toVersion = versions.find((v) => v.id === toVersionId)

  const addedCount = diffSegments.filter((s) => s.added).length
  const removedCount = diffSegments.filter((s) => s.removed).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Jämför versioner</DialogTitle>
        </DialogHeader>

        {/* Version selectors */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <span className="text-xs text-muted-foreground mb-1 block">
              Från
            </span>
            <Select
              value={fromVersionId}
              onValueChange={setFromVersionId}
              disabled={loadingVersions}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj version..." />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.version_number} — {v.author.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-muted-foreground mt-4">→</span>
          <div className="flex-1">
            <span className="text-xs text-muted-foreground mb-1 block">
              Till
            </span>
            <Select
              value={toVersionId}
              onValueChange={setToVersionId}
              disabled={loadingVersions}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj version..." />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.version_number} — {v.author.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary */}
        {diffSegments.length > 0 && !loading && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>
              v{fromVersion?.version_number} → v{toVersion?.version_number}
            </span>
            {addedCount > 0 && (
              <span className="text-green-700">+{addedCount} tillagt</span>
            )}
            {removedCount > 0 && (
              <span className="text-red-700">-{removedCount} borttaget</span>
            )}
            {addedCount === 0 && removedCount === 0 && (
              <span>Inga ändringar</span>
            )}
          </div>
        )}

        {/* Diff content */}
        <ScrollArea className="flex-1 min-h-0 rounded-md border p-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Beräknar skillnader...
            </div>
          ) : !fromVersionId || !toVersionId ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Välj två versioner att jämföra.
            </div>
          ) : fromVersionId === toVersionId ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Välj två olika versioner att jämföra.
            </div>
          ) : diffSegments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Inga ändringar mellan versionerna.
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed font-mono">
              {diffSegments.map((seg, i) => (
                <span
                  key={i}
                  className={cn(
                    seg.added &&
                      'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-300',
                    seg.removed &&
                      'bg-red-100 text-red-900 line-through dark:bg-red-900/30 dark:text-red-300'
                  )}
                >
                  {seg.value}
                </span>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
