'use client'

/**
 * Story 17.12: Documents Tab for Legal Document Modal
 * Shows documents linked to a law list item with link/unlink actions
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Plus, X, Loader2 } from 'lucide-react'
import { DocumentStatusBadge } from '@/components/features/documents/document-status-badge'
import { DocumentPickerModal } from '@/components/features/documents/document-picker-modal'
import {
  getDocumentsForListItem,
  linkDocumentToListItem,
  unlinkDocumentFromListItem,
} from '@/app/actions/documents'
import { toast } from 'sonner'
import Link from 'next/link'

// ============================================================================
// Types
// ============================================================================

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  POLICY: 'Policy',
  RISK_ASSESSMENT: 'Riskbedömning',
  ACTION_PLAN: 'Handlingsplan',
  ROUTINE: 'Rutin',
  INSTRUCTION: 'Instruktion',
  INVESTIGATION: 'Utredning',
  CHECKLIST: 'Checklista',
  OTHER: 'Övrigt',
}

interface LinkedDocument {
  id: string
  title: string
  documentType: string
  status: string
  versionNumber: number
  linkId: string
}

interface DocumentsTabProps {
  listItemId: string
  onUpdate?: (() => Promise<void>) | undefined
}

// ============================================================================
// Component
// ============================================================================

export function DocumentsTab({ listItemId, onUpdate }: DocumentsTabProps) {
  const [documents, setDocuments] = useState<LinkedDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)

  const loadDocuments = useCallback(async () => {
    const result = await getDocumentsForListItem(listItemId)
    if (result.success && result.data) {
      setDocuments(result.data)
    }
    setIsLoading(false)
  }, [listItemId])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const handleLink = async (documentIds: string[]) => {
    let linked = 0
    let failed = 0
    for (const docId of documentIds) {
      const result = await linkDocumentToListItem(docId, listItemId)
      if (result.success) {
        linked++
      } else {
        failed++
      }
    }
    if (failed > 0 && linked > 0) {
      toast.warning(`${linked} dokument länkade, ${failed} misslyckades`)
    } else if (failed > 0) {
      toast.error('Kunde inte länka dokument')
    } else {
      toast.success(
        linked === 1 ? 'Dokument länkat' : `${linked} dokument länkade`
      )
    }
    await loadDocuments()
    await onUpdate?.()
  }

  const handleUnlink = async (documentId: string) => {
    setUnlinkingId(documentId)
    const result = await unlinkDocumentFromListItem(documentId, listItemId)
    if (result.success) {
      setDocuments((prev) => prev.filter((d) => d.id !== documentId))
      toast.success('Länk borttagen')
      await onUpdate?.()
    } else {
      toast.error(result.error ?? 'Kunde inte ta bort länk')
    }
    setUnlinkingId(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {documents.length} dokument
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Länka dokument
          </Button>
        </div>

        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Inga länkade dokument
          </p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-2 p-2 rounded-md border group hover:bg-muted/50"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Link
                  href={`/workspace/documents/${doc.id}/edit`}
                  className="flex-1 min-w-0 truncate text-sm hover:underline"
                >
                  {doc.title}
                </Link>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 shrink-0"
                >
                  {DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                </Badge>
                <DocumentStatusBadge
                  status={doc.status}
                  className="text-[10px] px-1.5 py-0 shrink-0"
                />
                <span className="text-xs text-muted-foreground shrink-0">
                  v{doc.versionNumber}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={() => handleUnlink(doc.id)}
                  disabled={unlinkingId === doc.id}
                >
                  {unlinkingId === doc.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <DocumentPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleLink}
        excludeIds={documents.map((d) => d.id)}
      />
    </>
  )
}
