'use client'

/**
 * Story 6.18 + 17.16: Compliance accordion
 * - Top sub-section: KravpunkterChecklist (structured checklist — Story 17.16)
 * - Bottom sub-section: "Kommentar" free-text rich editor (Story 6.18, unchanged logic)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { mutate } from 'swr'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  RichTextEditor,
  RichTextDisplay,
} from '@/components/ui/rich-text-editor'
import { Button } from '@/components/ui/button'
import { Loader2, Check, ClipboardCheck, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateListItemComplianceActions } from '@/app/actions/legal-document-modal'
import { toast } from 'sonner'
import {
  KravpunkterChecklist,
  type KravpunkterProgress,
} from './kravpunkter-checklist'

interface ComplianceActionsProps {
  listItemId: string
  initialContent: string | null
  updatedAt?: Date | null | undefined
  updatedByName?: string | null | undefined
  /** Story 6.18: Callback to optimistically update list view */
  onContentChange?: ((_content: string | null) => void) | undefined
  /**
   * Story 6.18 + 17.18: Focus intent from "Lägg till" click in the list view.
   * - 'complianceActions' → auto-start editing the Kommentar field + scroll header into view
   * - 'kravpunkter'       → scroll header into view (section already open by default)
   * - anything else        → no-op
   */
  focusField?:
    | 'businessContext'
    | 'complianceActions'
    | 'kravpunkter'
    | null
    | undefined
  /** Story 17.16: Read-only disables all kravpunkter mutations + commentary edit */
  readOnly?: boolean | undefined
  /** Story 17.16: Notify parent of kravpunkter progress for DetailsBox status suggestion */
  onProgressChange?: ((_progress: KravpunkterProgress) => void) | undefined
}

type SaveStatus = 'idle' | 'saving' | 'saved'

export function ComplianceActions({
  listItemId,
  initialContent,
  updatedAt,
  updatedByName,
  onContentChange,
  focusField,
  readOnly = false,
  onProgressChange,
}: ComplianceActionsProps) {
  const [content, setContent] = useState(initialContent ?? '')
  const [editedContent, setEditedContent] = useState(initialContent ?? '')
  const [isEditing, setIsEditing] = useState(focusField === 'complianceActions')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const lastSavedRef = useRef(initialContent ?? '')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [progress, setProgress] = useState<KravpunkterProgress>({
    fulfilled: 0,
    total: 0,
  })
  const [kravpunkterHighlighted, setKravpunkterHighlighted] = useState(false)

  useEffect(() => {
    const handler = () => {
      setKravpunkterHighlighted(true)
      const t = window.setTimeout(() => setKravpunkterHighlighted(false), 1500)
      return () => window.clearTimeout(t)
    }
    window.addEventListener('laglig:focus-kravpunkter', handler)
    return () => window.removeEventListener('laglig:focus-kravpunkter', handler)
  }, [])

  const handleProgressChange = useCallback(
    (next: KravpunkterProgress) => {
      setProgress(next)
      onProgressChange?.(next)
    },
    [onProgressChange]
  )

  // Update local state when initialContent changes
  useEffect(() => {
    setContent(initialContent ?? '')
    setEditedContent(initialContent ?? '')
    lastSavedRef.current = initialContent ?? ''
  }, [initialContent])

  // Story 6.18: Auto-start editing when focus targets the Kommentar field
  useEffect(() => {
    if (focusField === 'complianceActions') {
      setIsEditing(true)
    }
  }, [focusField])

  // Story 17.18: Scroll the accordion header into view when the caller signals
  // focus on this section. Delay slightly to let modal-open animations settle.
  useEffect(() => {
    if (focusField !== 'complianceActions' && focusField !== 'kravpunkter') {
      return
    }
    const timer = setTimeout(() => {
      triggerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 150)
    return () => clearTimeout(timer)
  }, [focusField])

  const handleSave = useCallback(async () => {
    // Strip HTML tags for comparison and check if empty
    const strippedContent = editedContent.replace(/<[^>]*>/g, '').trim()
    const trimmed = strippedContent ? editedContent : null

    // Skip save if unchanged
    if (trimmed === lastSavedRef.current) {
      setIsEditing(false)
      return
    }

    setSaveStatus('saving')
    const result = await updateListItemComplianceActions(
      listItemId,
      trimmed ?? ''
    )

    if (result.success) {
      lastSavedRef.current = trimmed ?? ''
      setContent(trimmed ?? '')
      setSaveStatus('saved')
      setIsEditing(false)
      setTimeout(() => setSaveStatus('idle'), 2000)

      // Story 6.18: Optimistically update list view
      onContentChange?.(trimmed)

      // Optimistically update SWR caches so reopening modal shows new value instantly
      // Update extra fields cache (used when initialData is provided)
      mutate(
        `list-item-extra:${listItemId}`,
        (
          current:
            | {
                businessContext: string | null
                aiCommentary: string | null
                complianceActions: string | null
                complianceActionsUpdatedAt: Date | null
                complianceActionsUpdatedBy: string | null
              }
            | undefined
        ) => ({
          businessContext: current?.businessContext ?? null,
          aiCommentary: current?.aiCommentary ?? null,
          complianceActions: trimmed,
          complianceActionsUpdatedAt: new Date(),
          complianceActionsUpdatedBy:
            current?.complianceActionsUpdatedBy ?? null,
        }),
        { revalidate: false }
      )
      // Update full data cache (used when no initialData)
      mutate(
        `list-item:${listItemId}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (current: any) =>
          current
            ? {
                ...current,
                complianceActions: trimmed,
                complianceActionsUpdatedAt: new Date(),
              }
            : current,
        { revalidate: false }
      )
    } else {
      toast.error('Kunde inte spara', { description: result.error })
      setSaveStatus('idle')
    }
  }, [listItemId, editedContent, onContentChange])

  const handleCancel = () => {
    setEditedContent(content)
    setIsEditing(false)
  }

  const handleStartEdit = () => {
    setEditedContent(content)
    setIsEditing(true)
  }

  // Format metadata for display
  const formatMetadata = () => {
    if (!updatedAt) return null
    const dateStr = new Date(updatedAt).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    if (updatedByName) {
      return `Senast uppdaterad ${dateStr} av ${updatedByName}`
    }
    return `Senast uppdaterad ${dateStr}`
  }

  return (
    <AccordionItem
      value="compliance-actions"
      id="kravpunkter-accordion"
      className={cn(
        'border rounded-lg border-border/60 scroll-mt-4 transition-shadow duration-500',
        kravpunkterHighlighted && 'ring-2 ring-amber-400/70 shadow-lg'
      )}
    >
      <AccordionTrigger
        ref={triggerRef}
        className="px-4 py-3 hover:no-underline hover:bg-muted/50 rounded-t-lg data-[state=closed]:rounded-lg"
      >
        <div className="flex items-center gap-2 text-base font-semibold text-foreground flex-1">
          <ClipboardCheck className="h-4 w-4" />
          <span>Kravpunkter</span>
          {progress.total > 0 && (
            <div className="flex items-center gap-2 ml-auto mr-2 font-normal">
              <span className="text-xs text-muted-foreground tabular-nums">
                {progress.fulfilled}/{progress.total} uppfyllda
              </span>
              <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      progress.total > 0
                        ? Math.round(
                            (progress.fulfilled / progress.total) * 100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 space-y-3">
        {/* Story 17.16: Structured checklist */}
        <KravpunkterChecklist
          listItemId={listItemId}
          readOnly={readOnly}
          onProgressChange={handleProgressChange}
        />

        {/* Story 6.18: Generella kommentarer (free-text rich editor, list-item-wide) */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Generella kommentarer
          </h4>
          {isEditing ? (
            <div className="space-y-3">
              <SaveStatusIndicator status={saveStatus} align="end" />

              <RichTextEditor
                content={editedContent}
                onChange={setEditedContent}
                placeholder="Beskriv hur ni efterlever lagens krav..."
              />

              {/* Save/Cancel buttons */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saveStatus === 'saving'}
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Sparar...
                    </>
                  ) : (
                    'Spara'
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={saveStatus === 'saving'}
                >
                  Avbryt
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <SaveStatusIndicator status={saveStatus} align="end" />

              {/* Clickable display area (disabled when readOnly) */}
              <div
                role={readOnly ? undefined : 'button'}
                tabIndex={readOnly ? undefined : 0}
                onClick={readOnly ? undefined : handleStartEdit}
                onKeyDown={
                  readOnly
                    ? undefined
                    : (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleStartEdit()
                        }
                      }
                }
                className={cn(
                  'rounded-md border border-transparent p-3 group relative',
                  !readOnly &&
                    'cursor-pointer hover:border-input hover:bg-muted/30 transition-colors'
                )}
              >
                <RichTextDisplay content={content} />

                {/* Edit hint on hover — hidden in readOnly */}
                {!readOnly && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
                      <Pencil className="h-3 w-3" />
                      Klicka för att redigera
                    </div>
                  </div>
                )}
              </div>

              {/* Metadata display */}
              {formatMetadata() && (
                <p className="text-xs text-muted-foreground mt-2">
                  {formatMetadata()}
                </p>
              )}
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

function SaveStatusIndicator({
  status,
  align = 'start',
}: {
  status: SaveStatus
  align?: 'start' | 'end'
}) {
  if (status === 'idle') return null

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-xs text-muted-foreground',
        align === 'end' && 'justify-end'
      )}
    >
      {status === 'saving' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Sparar...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="h-3 w-3 text-green-500" />
          <span>Sparat</span>
        </>
      )}
    </div>
  )
}
