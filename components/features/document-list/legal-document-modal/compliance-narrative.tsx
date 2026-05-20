'use client'

/**
 * Story 21.22: "Hur efterlever vi kraven?" — first-class top-level accordion
 * on the law-list-item modal. Renamed from the legacy compliance_actions field
 * which had been demoted to a sub-section of the Kravpunkter accordion in
 * Story 17.16. Lives BETWEEN business-context (Hur påverkar detta oss?) and
 * Kravpunkter so the modal reads top-down: context → claim → requirements →
 * evidence.
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
import { Loader2, Check, BookText, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateListItemComplianceNarrative } from '@/app/actions/legal-document-modal'
import { toast } from 'sonner'

interface ComplianceNarrativeProps {
  listItemId: string
  initialContent: string | null
  updatedAt?: Date | null | undefined
  updatedByName?: string | null | undefined
  onContentChange?: ((_content: string | null) => void) | undefined
  /**
   * 'complianceNarrative' → auto-start editing + scroll header into view.
   * Other values → no-op.
   */
  focusField?:
    | 'businessContext'
    | 'complianceNarrative'
    | 'kravpunkter'
    | null
    | undefined
  readOnly?: boolean | undefined
}

type SaveStatus = 'idle' | 'saving' | 'saved'

export function ComplianceNarrative({
  listItemId,
  initialContent,
  updatedAt,
  updatedByName,
  onContentChange,
  focusField,
  readOnly = false,
}: ComplianceNarrativeProps) {
  const [content, setContent] = useState(initialContent ?? '')
  const [editedContent, setEditedContent] = useState(initialContent ?? '')
  const [isEditing, setIsEditing] = useState(
    focusField === 'complianceNarrative'
  )
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const lastSavedRef = useRef(initialContent ?? '')
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setContent(initialContent ?? '')
    setEditedContent(initialContent ?? '')
    lastSavedRef.current = initialContent ?? ''
  }, [initialContent])

  useEffect(() => {
    if (focusField === 'complianceNarrative') {
      setIsEditing(true)
    }
  }, [focusField])

  useEffect(() => {
    if (focusField !== 'complianceNarrative') return
    const timer = setTimeout(() => {
      triggerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 150)
    return () => clearTimeout(timer)
  }, [focusField])

  const handleSave = useCallback(async () => {
    const strippedContent = editedContent.replace(/<[^>]*>/g, '').trim()
    const trimmed = strippedContent ? editedContent : null

    if (trimmed === lastSavedRef.current) {
      setIsEditing(false)
      return
    }

    setSaveStatus('saving')
    const result = await updateListItemComplianceNarrative(
      listItemId,
      trimmed ?? ''
    )

    if (result.success) {
      lastSavedRef.current = trimmed ?? ''
      setContent(trimmed ?? '')
      setSaveStatus('saved')
      setIsEditing(false)
      setTimeout(() => setSaveStatus('idle'), 2000)

      onContentChange?.(trimmed)

      mutate(
        `list-item-extra:${listItemId}`,
        (
          current:
            | {
                businessContext: string | null
                aiCommentary: string | null
                complianceNarrative: string | null
                complianceNarrativeUpdatedAt: Date | null
                complianceNarrativeUpdatedBy: string | null
              }
            | undefined
        ) => ({
          businessContext: current?.businessContext ?? null,
          aiCommentary: current?.aiCommentary ?? null,
          complianceNarrative: trimmed,
          complianceNarrativeUpdatedAt: new Date(),
          complianceNarrativeUpdatedBy:
            current?.complianceNarrativeUpdatedBy ?? null,
        }),
        { revalidate: false }
      )
      mutate(
        `list-item:${listItemId}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (current: any) =>
          current
            ? {
                ...current,
                complianceNarrative: trimmed,
                complianceNarrativeUpdatedAt: new Date(),
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

  const hasContent = content.replace(/<[^>]*>/g, '').trim().length > 0

  return (
    <AccordionItem
      value="compliance-narrative"
      id="compliance-narrative-accordion"
      className="border rounded-lg border-border/60 scroll-mt-4"
    >
      <AccordionTrigger
        ref={triggerRef}
        className="group/trigger px-4 py-3 hover:no-underline hover:bg-muted/50 rounded-t-lg data-[state=closed]:rounded-lg"
      >
        <div className="flex items-center gap-2 text-base font-semibold text-foreground flex-1 min-w-0">
          <BookText className="h-4 w-4 shrink-0" />
          <span className="shrink-0">Hur efterlever vi kraven?</span>
          {/* Collapsed-state meta: 1-line preview when filled, "Ej ifylld" when empty */}
          {hasContent ? (
            <span className="ml-auto mr-2 max-w-[22ch] truncate text-xs font-normal text-muted-foreground group-data-[state=open]/trigger:hidden">
              {content
                .replace(/<[^>]*>/g, '')
                .replace(/\s+/g, ' ')
                .trim()}
            </span>
          ) : (
            <span className="ml-auto mr-2 shrink-0 text-xs font-normal italic text-muted-foreground/70 group-data-[state=open]/trigger:hidden">
              Ej ifylld
            </span>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        {isEditing ? (
          <div className="space-y-3">
            <SaveStatusIndicator status={saveStatus} align="end" />

            <RichTextEditor
              content={editedContent}
              onChange={setEditedContent}
              placeholder="Beskriv hur ni efterlever lagens krav i praktiken — rutiner, ansvariga, kontroller, dokumentation..."
            />

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
              {hasContent ? (
                <RichTextDisplay content={content} />
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {readOnly
                    ? 'Ingen beskrivning ännu.'
                    : 'Klicka för att beskriva hur ni efterlever kraven.'}
                </p>
              )}

              {!readOnly && hasContent && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
                    <Pencil className="h-3 w-3" />
                    Klicka för att redigera
                  </div>
                </div>
              )}
            </div>

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
