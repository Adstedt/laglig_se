'use client'

/**
 * Story 17.12: Document Picker Modal
 * Searchable modal for selecting workspace documents to link.
 * Uses CommandDialog (cmdk) for keyboard-navigable search.
 * Mirrors FilePickerModal pattern.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Loader2, FileText } from 'lucide-react'
import { DocumentStatusBadge } from './document-status-badge'
import { getWorkspaceDocuments } from '@/app/actions/documents'
import { toast } from 'sonner'

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

interface DocumentItem {
  id: string
  title: string
  document_type: string
  status: string
  current_version_number: number
}

interface DocumentPickerModalProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  onSelect: (_documentIds: string[]) => void
  excludeIds?: string[]
  allowMultiple?: boolean
}

// ============================================================================
// Component
// ============================================================================

export function DocumentPickerModal({
  open,
  onOpenChange,
  onSelect,
  excludeIds = [],
  allowMultiple = true,
}: DocumentPickerModalProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch documents when modal opens
  useEffect(() => {
    if (open) {
      loadDocuments()
    } else {
      setSelected(new Set())
      setSearchQuery('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const loadDocuments = async () => {
    setIsLoading(true)
    try {
      const result = await getWorkspaceDocuments(
        searchQuery ? { search: searchQuery, take: 200 } : { take: 200 }
      )

      if (
        result.success &&
        result.data &&
        typeof result.data === 'object' &&
        'items' in result.data
      ) {
        setDocuments((result.data as { items: DocumentItem[] }).items)
      }
    } catch (error) {
      console.error('Failed to load documents:', error)
      toast.error('Kunde inte ladda dokument')
    } finally {
      setIsLoading(false)
    }
  }

  // Debounced search
  useEffect(() => {
    if (!open) return

    const timer = setTimeout(() => {
      loadDocuments()
    }, 300)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, open])

  const toggleSelect = useCallback(
    (docId: string) => {
      if (excludeIds.includes(docId)) return

      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(docId)) {
          next.delete(docId)
        } else {
          if (!allowMultiple) {
            next.clear()
          }
          next.add(docId)
        }
        return next
      })
    },
    [excludeIds, allowMultiple]
  )

  const handleConfirm = () => {
    onSelect(Array.from(selected))
    setSelected(new Set())
    onOpenChange(false)
  }

  const availableDocs = documents.filter((d) => !excludeIds.includes(d.id))
  const alreadyLinkedDocs = documents.filter((d) => excludeIds.includes(d.id))

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Sök dokument..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />

      <CommandList className="max-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <CommandEmpty>Inga dokument hittades</CommandEmpty>

            {availableDocs.length > 0 && (
              <CommandGroup heading="Tillgängliga dokument">
                {availableDocs.map((doc) => (
                  <CommandItem
                    key={doc.id}
                    value={`${doc.title} ${doc.document_type}`}
                    onSelect={() => toggleSelect(doc.id)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.has(doc.id)}
                      className="pointer-events-none"
                    />
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">
                        v{doc.current_version_number}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {DOCUMENT_TYPE_LABELS[doc.document_type] ??
                        doc.document_type}
                    </Badge>
                    <DocumentStatusBadge
                      status={doc.status}
                      className="text-[10px] px-1.5 py-0"
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {alreadyLinkedDocs.length > 0 && (
              <CommandGroup heading="Redan länkade">
                {alreadyLinkedDocs.map((doc) => (
                  <CommandItem
                    key={doc.id}
                    value={`${doc.title} ${doc.document_type}`}
                    disabled
                    className="flex items-center gap-3 opacity-50"
                  >
                    <Checkbox
                      checked
                      disabled
                      className="pointer-events-none"
                    />
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">
                        v{doc.current_version_number}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {DOCUMENT_TYPE_LABELS[doc.document_type] ??
                        doc.document_type}
                    </Badge>
                    <DocumentStatusBadge
                      status={doc.status}
                      className="text-[10px] px-1.5 py-0"
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>

      <Separator />

      <div className="p-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {selected.size} dokument vald{selected.size !== 1 ? 'a' : 't'}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0}>
            Länka
          </Button>
        </div>
      </div>
    </CommandDialog>
  )
}
