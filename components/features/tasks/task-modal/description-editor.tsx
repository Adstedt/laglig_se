'use client'

/**
 * Story 6.6: Description Editor
 * Click-to-edit rich text description with Jira-style toolbar
 * Shows rendered text by default, editor on click with Save/Cancel
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  RichTextEditor,
  RichTextDisplay,
} from '@/components/ui/rich-text-editor'
import { Button } from '@/components/ui/button'
import { Loader2, Check, FileText, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateTaskDescription } from '@/app/actions/task-modal'
import { toast } from 'sonner'

interface DescriptionEditorProps {
  taskId: string
  initialDescription: string | null
  onUpdate: () => Promise<void>
  /** Optimistic callback to sync description changes to parent (e.g. list view) */
  onOptimisticChange?: ((_description: string | null) => void) | undefined
  /** Hide the label when embedded in an accordion */
  hideLabel?: boolean
  /** Workspace members for @mentions */
  workspaceMembers?: Array<{ id: string; name: string | null; email: string }>
}

type SaveStatus = 'idle' | 'saving' | 'saved'

export function DescriptionEditor({
  taskId,
  initialDescription,
  onUpdate,
  onOptimisticChange,
  hideLabel = false,
  workspaceMembers = [],
}: DescriptionEditorProps) {
  const [description, setDescription] = useState(initialDescription ?? '')
  const [editedDescription, setEditedDescription] = useState(
    initialDescription ?? ''
  )
  const [isEditing, setIsEditing] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const lastSavedRef = useRef(initialDescription ?? '')

  // Update local state when initialDescription changes
  useEffect(() => {
    setDescription(initialDescription ?? '')
    setEditedDescription(initialDescription ?? '')
    lastSavedRef.current = initialDescription ?? ''
  }, [initialDescription])

  const handleSave = useCallback(async () => {
    // Strip HTML tags for comparison and check if empty
    const strippedContent = editedDescription.replace(/<[^>]*>/g, '').trim()
    const trimmed = strippedContent ? editedDescription : null

    // Skip save if unchanged
    if (trimmed === lastSavedRef.current) {
      setIsEditing(false)
      return
    }

    setSaveStatus('saving')
    const result = await updateTaskDescription(taskId, trimmed)

    if (result.success) {
      lastSavedRef.current = trimmed ?? ''
      setDescription(trimmed ?? '')
      setSaveStatus('saved')
      setIsEditing(false)
      onOptimisticChange?.(trimmed ?? null)
      await onUpdate()
      setTimeout(() => setSaveStatus('idle'), 2000)
    } else {
      toast.error('Fel', { description: result.error })
      setSaveStatus('idle')
    }
  }, [taskId, editedDescription, onUpdate, onOptimisticChange])

  const handleCancel = () => {
    setEditedDescription(description)
    setIsEditing(false)
  }

  const handleStartEdit = () => {
    setEditedDescription(description)
    setIsEditing(true)
  }

  // Convert members to the format expected by RichTextEditor
  const members = workspaceMembers.map((m) => ({
    id: m.id,
    name: m.name ?? '',
    email: m.email,
  }))

  // Show editor mode
  if (isEditing) {
    return (
      <div className="space-y-3">
        {!hideLabel && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              Beskrivning
            </span>
            <SaveStatusIndicator status={saveStatus} />
          </div>
        )}
        {hideLabel && <SaveStatusIndicator status={saveStatus} align="end" />}

        <RichTextEditor
          content={editedDescription}
          onChange={setEditedDescription}
          placeholder="Lägg till en beskrivning..."
          members={members}
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
    )
  }

  // Show display mode (click to edit)
  return (
    <div className="space-y-2">
      {!hideLabel && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            Beskrivning
          </span>
          <SaveStatusIndicator status={saveStatus} />
        </div>
      )}
      {hideLabel && <SaveStatusIndicator status={saveStatus} align="end" />}

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
        <RichTextDisplay content={description} />

        {/* Edit hint on hover */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
            <Pencil className="h-3 w-3" />
            Klicka för att redigera
          </div>
        </div>
      </div>
    </div>
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
