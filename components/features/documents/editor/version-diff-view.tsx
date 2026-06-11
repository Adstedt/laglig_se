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
import {
  getDocumentVersions,
  getDocumentVersionContent,
  type DocumentVersionEntry,
} from '@/app/actions/documents'
import { computeDiff, type DiffSegment } from '@/lib/utils/document-diff'
import { cn } from '@/lib/utils'

interface TiptapNodeLike {
  type?: string
  text?: string
  content?: TiptapNodeLike[]
}

/** Concatenate a node's inline text (already entity-decoded in Tiptap JSON). */
function inlineText(node: TiptapNodeLike): string {
  if (typeof node.text === 'string') return node.text
  if (Array.isArray(node.content)) return node.content.map(inlineText).join('')
  return ''
}

/**
 * Derive block-structured plaintext from a version's Tiptap `content_json`:
 * each heading / paragraph / list item is its own block, blocks separated by a
 * blank line. Diffing this (instead of the flattened, entity-encoded
 * `extracted_text`) preserves document structure and avoids "&amp;" leaking.
 */
function tiptapToBlockText(json: unknown): string {
  const doc = json as TiptapNodeLike | null
  if (!doc || !Array.isArray(doc.content)) return ''
  const blocks: string[] = []
  const walk = (nodes: TiptapNodeLike[]) => {
    for (const node of nodes) {
      if (node.type === 'bulletList' || node.type === 'orderedList') {
        for (const item of node.content ?? []) {
          const t = inlineText(item).trim()
          if (t) blocks.push(`• ${t}`)
        }
      } else if (
        node.type === 'heading' ||
        node.type === 'paragraph' ||
        node.type === 'blockquote' ||
        node.type === 'codeBlock'
      ) {
        const t = inlineText(node).trim()
        if (t) blocks.push(t)
      } else if (Array.isArray(node.content)) {
        walk(node.content)
      }
    }
  }
  walk(doc.content)
  return blocks.join('\n\n')
}

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
      // Prefer the structured content_json projection; fall back to the
      // flattened extracted_text for legacy versions that lack content_json.
      const fromText =
        tiptapToBlockText(fromResult.data.content_json) ||
        fromResult.data.extracted_text
      const toText =
        tiptapToBlockText(toResult.data.content_json) ||
        toResult.data.extracted_text
      const segments = computeDiff(fromText, toText)
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

        {/* Diff content — native scroll container with a bounded height so a
            long document scrolls reliably (flex-1 height didn't propagate). */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border p-4">
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
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {diffSegments.map((seg, i) => (
                <span
                  key={i}
                  className={cn(
                    seg.added &&
                      'rounded-[3px] bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300',
                    seg.removed &&
                      'rounded-[3px] bg-rose-100 text-rose-900 line-through dark:bg-rose-900/30 dark:text-rose-300'
                  )}
                >
                  {seg.value}
                </span>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
