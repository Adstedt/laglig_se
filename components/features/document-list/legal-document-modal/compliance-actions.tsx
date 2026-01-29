'use client'

/**
 * Story 6.18: Compliance Actions
 * Rich text editor accordion item for describing how we comply with the law
 * Uses Jira-style click-to-edit with Save/Cancel workflow
 * Pattern copied from business-context.tsx
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

interface ComplianceActionsProps {
  listItemId: string
  initialContent: string | null
  updatedAt?: Date | null | undefined
  updatedByName?: string | null | undefined
  /** Story 6.18: Callback to optimistically update list view */
  onContentChange?: ((_content: string | null) => void) | undefined
  /** Story 6.18: Auto-start in edit mode (from "Lägg till" click) */
  autoEdit?: boolean | undefined
}

type SaveStatus = 'idle' | 'saving' | 'saved'

export function ComplianceActions({
  listItemId,
  initialContent,
  updatedAt,
  updatedByName,
  onContentChange,
  autoEdit = false,
}: ComplianceActionsProps) {
  const [content, setContent] = useState(initialContent ?? '')
  const [editedContent, setEditedContent] = useState(initialContent ?? '')
  const [isEditing, setIsEditing] = useState(autoEdit)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const lastSavedRef = useRef(initialContent ?? '')

  // Update local state when initialContent changes
  useEffect(() => {
    setContent(initialContent ?? '')
    setEditedContent(initialContent ?? '')
    lastSavedRef.current = initialContent ?? ''
  }, [initialContent])

  // Story 6.18: Auto-start editing when autoEdit prop is true
  useEffect(() => {
    if (autoEdit) {
      setIsEditing(true)
    }
  }, [autoEdit])

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
      className="border rounded-lg border-border/60"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 rounded-t-lg data-[state=closed]:rounded-lg">
        <div className="flex items-center gap-2 text-base font-semibold text-foreground">
          <ClipboardCheck className="h-4 w-4" />
          <span>Hur efterlever vi kraven?</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
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

            {/* Clickable display area */}
            <div
              role="button"
              tabIndex={0}
              onClick={handleStartEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleStartEdit()
                }
              }}
              className={cn(
                'cursor-pointer rounded-md border border-transparent',
                'hover:border-input hover:bg-muted/30 transition-colors',
                'p-3',
                'group relative'
              )}
            >
              <RichTextDisplay content={content} />

              {/* Edit hint on hover */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
                  <Pencil className="h-3 w-3" />
                  Klicka för att redigera
                </div>
              </div>
            </div>

            {/* Metadata display */}
            {formatMetadata() && (
              <p className="text-xs text-muted-foreground mt-2">
                {formatMetadata()}
              </p>
            )}
          </div>
        )}
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
