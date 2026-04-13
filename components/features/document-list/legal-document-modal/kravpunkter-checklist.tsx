'use client'

/**
 * Story 17.16: Kravpunkter Checklist
 * Structured compliance checklist per LawListItem.
 * Self-contained: fetches via SWR, mutates via server actions + optimistic updates.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { toast } from 'sonner'
import {
  Plus,
  X,
  ChevronRight,
  Paperclip,
  FileText,
  File as FileIcon,
  Loader2,
  ClipboardCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { cn } from '@/lib/utils'
import {
  createRequirement,
  updateRequirement,
  deleteRequirement,
  getRequirementsForListItem,
  linkEvidenceToRequirement,
  unlinkEvidenceFromRequirement,
  type RequirementWithEvidence,
  type RequirementEvidenceSummary,
} from '@/app/actions/law-list-item-requirements'
import { FilePickerModal } from '@/components/features/files/file-picker-modal'
import { DocumentPickerModal } from '@/components/features/documents/document-picker-modal'

// ============================================================================
// Types
// ============================================================================

export interface KravpunkterProgress {
  fulfilled: number
  total: number
}

interface KravpunkterChecklistProps {
  listItemId: string
  readOnly?: boolean
  onProgressChange?: (_progress: KravpunkterProgress) => void
}

// ============================================================================
// Main component
// ============================================================================

export function KravpunkterChecklist({
  listItemId,
  readOnly = false,
  onProgressChange,
}: KravpunkterChecklistProps) {
  const swrKey = `list-item-requirements:${listItemId}`
  const { data: requirements, isLoading } = useSWR<RequirementWithEvidence[]>(
    swrKey,
    async () => {
      const result = await getRequirementsForListItem(listItemId)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta kravpunkter')
      }
      return result.data
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  )

  // Report progress upward whenever requirements change.
  useEffect(() => {
    if (!onProgressChange) return
    const total = requirements?.length ?? 0
    const fulfilled = requirements?.filter((r) => r.isFulfilled).length ?? 0
    onProgressChange({ fulfilled, total })
  }, [requirements, onProgressChange])

  const [isAdding, setIsAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAdding) addInputRef.current?.focus()
  }, [isAdding])

  // See KravpunktRow above — same window-capture pattern to beat Radix Dialog's listener.
  useEffect(() => {
    if (!isAdding) return
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        document.activeElement === addInputRef.current
      ) {
        e.preventDefault()
        e.stopImmediatePropagation()
        setNewText('')
        setIsAdding(false)
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () =>
      window.removeEventListener('keydown', handler, { capture: true })
  }, [isAdding])

  const handleAdd = useCallback(async () => {
    const text = newText.trim()
    if (!text) {
      setIsAdding(false)
      return
    }
    const result = await createRequirement(listItemId, text)
    if (result.success && result.data) {
      setNewText('')
      setIsAdding(false)
      // Append optimistically and revalidate.
      const created = result.data
      await globalMutate(
        swrKey,
        (current?: RequirementWithEvidence[]) => [...(current ?? []), created],
        { revalidate: false }
      )
    } else {
      toast.error('Kunde inte skapa kravpunkt', { description: result.error })
    }
  }, [newText, listItemId, swrKey])

  if (isLoading && !requirements) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Laddar kravpunkter…</span>
      </div>
    )
  }

  const hasRequirements = (requirements?.length ?? 0) > 0

  return (
    <div className="space-y-2">
      {/* Empty state */}
      {!hasRequirements && !isAdding && (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
            <ClipboardCheck className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">
            Inga kravpunkter definierade
          </p>
          {!readOnly && (
            <p className="text-xs text-muted-foreground/60 mt-1">
              Lägg till din första kravpunkt
            </p>
          )}
        </div>
      )}

      {/* Rows */}
      {hasRequirements && (
        <ul className="space-y-1">
          {requirements?.map((req) => (
            <KravpunktRow
              key={req.id}
              requirement={req}
              swrKey={swrKey}
              readOnly={readOnly}
            />
          ))}
        </ul>
      )}

      {/* Add new */}
      {!readOnly && (
        <div className="pt-1">
          {isAdding ? (
            <Input
              ref={addInputRef}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onBlur={handleAdd}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAdd()
                }
                // Escape is handled by the window-capture listener in useEffect above —
                // it must run before Radix Dialog's document-level handler can close the modal.
              }}
              placeholder="Beskriv kravpunkten…"
              maxLength={500}
              className="h-9 text-sm"
            />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground hover:text-foreground"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Lägg till kravpunkt
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Row component
// ============================================================================

interface KravpunktRowProps {
  requirement: RequirementWithEvidence
  swrKey: string
  readOnly: boolean
}

function KravpunktRow({ requirement, swrKey, readOnly }: KravpunktRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(requirement.text)
  const [isExpanded, setIsExpanded] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  // Keep local edit buffer in sync if requirement.text changes externally.
  useEffect(() => {
    if (!isEditing) setEditText(requirement.text)
  }, [requirement.text, isEditing])

  // Radix Dialog listens for Escape on document with capture: true. To intercept
  // before they do, listen on window capture (fires earlier in the event chain).
  useEffect(() => {
    if (!isEditing) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        e.preventDefault()
        e.stopImmediatePropagation()
        setEditText(requirement.text)
        setIsEditing(false)
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () =>
      window.removeEventListener('keydown', handler, { capture: true })
  }, [isEditing, requirement.text])

  const patchRow = useCallback(
    (patch: Partial<RequirementWithEvidence>) => {
      globalMutate(
        swrKey,
        (current?: RequirementWithEvidence[]) =>
          current?.map((r) =>
            r.id === requirement.id ? { ...r, ...patch } : r
          ),
        { revalidate: false }
      )
    },
    [swrKey, requirement.id]
  )

  const handleToggleFulfilled = useCallback(
    async (next: boolean) => {
      patchRow({ isFulfilled: next })
      const result = await updateRequirement(requirement.id, {
        isFulfilled: next,
      })
      if (!result.success) {
        patchRow({ isFulfilled: !next })
        toast.error('Kunde inte uppdatera', { description: result.error })
      }
    },
    [requirement.id, patchRow]
  )

  const handleSaveText = useCallback(async () => {
    const trimmed = editText.trim()
    if (!trimmed || trimmed === requirement.text) {
      setEditText(requirement.text)
      setIsEditing(false)
      return
    }
    const prev = requirement.text
    patchRow({ text: trimmed })
    setIsEditing(false)
    const result = await updateRequirement(requirement.id, { text: trimmed })
    if (!result.success) {
      patchRow({ text: prev })
      setEditText(prev)
      toast.error('Kunde inte spara', { description: result.error })
    }
  }, [editText, requirement.id, requirement.text, patchRow])

  // Compliance data deserves explicit confirmation rather than an undo window —
  // the prior sonner-based undo pattern was unreliable across re-renders/timing.
  const handleConfirmDelete = useCallback(async () => {
    // Optimistic removal first so the UI feels responsive.
    globalMutate(
      swrKey,
      (current?: RequirementWithEvidence[]) =>
        current?.filter((r) => r.id !== requirement.id),
      { revalidate: false }
    )
    setConfirmDeleteOpen(false)

    const result = await deleteRequirement(requirement.id)
    if (!result.success) {
      // Restore on server failure.
      globalMutate(
        swrKey,
        (current?: RequirementWithEvidence[]) => {
          const next = [...(current ?? []), requirement]
          return next.sort((a, b) => a.position - b.position)
        },
        { revalidate: false }
      )
      toast.error('Kunde inte ta bort kravpunkt', {
        description: result.error,
      })
    }
  }, [requirement, swrKey])

  const evidenceCount = requirement.evidence.length

  return (
    <li className="group">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div
          className={cn(
            'flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors',
            'hover:bg-muted/40'
          )}
        >
          {/* Checkbox */}
          <Checkbox
            checked={requirement.isFulfilled}
            onCheckedChange={(next) => handleToggleFulfilled(Boolean(next))}
            disabled={readOnly}
            className="mt-0.5 shrink-0"
            aria-label="Markera som uppfylld"
          />

          {/* Text / inline edit */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <Input
                ref={inputRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={handleSaveText}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSaveText()
                  }
                  // Escape is handled by the window-capture listener in useEffect above.
                }}
                maxLength={500}
                className="h-7 text-sm py-0"
              />
            ) : (
              <button
                type="button"
                onClick={() => !readOnly && setIsEditing(true)}
                disabled={readOnly}
                className={cn(
                  'text-sm text-left w-full leading-snug',
                  requirement.isFulfilled && 'text-muted-foreground',
                  !readOnly && 'cursor-text hover:text-foreground'
                )}
              >
                {requirement.text}
              </button>
            )}
          </div>

          {/* Evidence count badge */}
          {evidenceCount > 0 && (
            <Badge
              variant="secondary"
              className="shrink-0 h-5 text-xs font-normal"
            >
              <Paperclip className="h-3 w-3 mr-1" />
              {evidenceCount} {evidenceCount === 1 ? 'bevis' : 'bevis'}
            </Badge>
          )}

          {/* Expand chevron */}
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground"
              aria-label={isExpanded ? 'Dölj bevis' : 'Visa bevis'}
            >
              <ChevronRight
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  isExpanded && 'rotate-90'
                )}
              />
            </button>
          </CollapsibleTrigger>

          {/* Delete (opens confirmation dialog) */}
          {!readOnly && (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className={cn(
                'shrink-0 p-1 rounded hover:bg-destructive/10 transition-all',
                'opacity-0 group-hover:opacity-60 hover:!opacity-100'
              )}
              title="Ta bort kravpunkt"
              aria-label="Ta bort kravpunkt"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </div>

        <CollapsibleContent>
          <EvidenceList
            requirementId={requirement.id}
            swrKey={swrKey}
            evidence={requirement.evidence}
            readOnly={readOnly}
          />
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort kravpunkt?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{requirement.text}&quot; och alla länkade bevis tas bort.
              Detta kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

// ============================================================================
// Evidence list
// ============================================================================

interface EvidenceListProps {
  requirementId: string
  swrKey: string
  evidence: RequirementEvidenceSummary[]
  readOnly: boolean
}

function EvidenceList({
  requirementId,
  swrKey,
  evidence,
  readOnly,
}: EvidenceListProps) {
  const [filePickerOpen, setFilePickerOpen] = useState(false)
  const [docPickerOpen, setDocPickerOpen] = useState(false)

  const patchEvidence = useCallback(
    (
      updater: (
        _prev: RequirementEvidenceSummary[]
      ) => RequirementEvidenceSummary[]
    ) => {
      globalMutate(
        swrKey,
        (current?: RequirementWithEvidence[]) =>
          current?.map((r) =>
            r.id === requirementId ? { ...r, evidence: updater(r.evidence) } : r
          ),
        { revalidate: false }
      )
    },
    [swrKey, requirementId]
  )

  const handleLinkFiles = useCallback(
    async (fileIds: string[]) => {
      setFilePickerOpen(false)
      for (const fileId of fileIds) {
        const result = await linkEvidenceToRequirement(requirementId, {
          fileId,
        })
        if (!result.success) {
          toast.error('Kunde inte länka fil', { description: result.error })
        }
      }
      // Revalidate once after the batch finishes so picker reflects truth.
      globalMutate(swrKey)
    },
    [requirementId, swrKey]
  )

  const handleLinkDocuments = useCallback(
    async (documentIds: string[]) => {
      setDocPickerOpen(false)
      for (const documentId of documentIds) {
        const result = await linkEvidenceToRequirement(requirementId, {
          workspaceDocumentId: documentId,
        })
        if (!result.success) {
          toast.error('Kunde inte länka dokument', {
            description: result.error,
          })
        }
      }
      globalMutate(swrKey)
    },
    [requirementId, swrKey]
  )

  const handleUnlink = useCallback(
    async (link: RequirementEvidenceSummary) => {
      patchEvidence((prev) => prev.filter((e) => e.id !== link.id))

      const payload = link.file
        ? { fileId: link.file.id }
        : link.workspaceDocument
          ? { workspaceDocumentId: link.workspaceDocument.id }
          : null
      if (!payload) return

      const result = await unlinkEvidenceFromRequirement(requirementId, payload)
      if (!result.success) {
        patchEvidence((prev) => [...prev, link])
        toast.error('Kunde inte ta bort länk', { description: result.error })
      }
    },
    [requirementId, patchEvidence]
  )

  const linkedFileIds = evidence
    .map((e) => e.file?.id)
    .filter(Boolean) as string[]
  const linkedDocumentIds = evidence
    .map((e) => e.workspaceDocument?.id)
    .filter(Boolean) as string[]

  return (
    <div className="ml-7 mt-1 mb-2 space-y-1">
      {evidence.length === 0 ? (
        <p className="text-xs text-muted-foreground/70 italic px-2 py-1">
          Inga bevis länkade.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {evidence.map((link) => (
            <li
              key={link.id}
              className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/30 group/evidence"
            >
              {link.file ? (
                <>
                  <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{link.file.filename}</span>
                </>
              ) : link.workspaceDocument ? (
                <>
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">
                    {link.workspaceDocument.title}
                  </span>
                </>
              ) : null}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleUnlink(link)}
                  className={cn(
                    'shrink-0 p-0.5 rounded hover:bg-destructive/10',
                    'opacity-0 group-hover/evidence:opacity-60 hover:!opacity-100 transition-opacity'
                  )}
                  aria-label="Ta bort länk"
                  title="Ta bort länk"
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3 mr-1" />
              Länka bevis
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setFilePickerOpen(true)}>
              <FileIcon className="h-4 w-4 mr-2" />
              Fil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDocPickerOpen(true)}>
              <FileText className="h-4 w-4 mr-2" />
              Dokument
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <FilePickerModal
        open={filePickerOpen}
        onOpenChange={setFilePickerOpen}
        onSelect={handleLinkFiles}
        excludeIds={linkedFileIds}
        allowMultiple
      />
      <DocumentPickerModal
        open={docPickerOpen}
        onOpenChange={setDocPickerOpen}
        onSelect={handleLinkDocuments}
        excludeIds={linkedDocumentIds}
        allowMultiple
      />
    </div>
  )
}
