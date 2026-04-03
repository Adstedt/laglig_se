'use client'

/**
 * Story 14.15b, Task 5: Context note write preview card.
 * Shows law title, existing notes, editable new note, confirm/cancel.
 */

import { useState } from 'react'
import { Check, Loader2, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { updateListItem } from '@/app/actions/document-list'
import { useChatDetail } from '@/lib/ai/chat-detail-context'
import type { WriteToolResponse } from '@/lib/agent/tools/types'

interface WritePreviewNoteProps {
  data: WriteToolResponse<unknown>
}

export function WritePreviewNote({ data }: WritePreviewNoteProps) {
  const { closeDetail, addSystemMessage } = useChatDetail()
  const params = data.params ?? {}

  const listItemId = (params.listItemId as string) ?? ''
  const lawTitle =
    (params.lawTitle as string) ?? (params.documentTitle as string) ?? ''
  const existingNotes = (params.existingNotes as string) ?? ''
  const [note, setNote] = useState(
    (params.note as string) ?? (params.notes as string) ?? ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleConfirm = async () => {
    if (!note.trim()) {
      setError('Anteckning krävs')
      return
    }
    setSaving(true)
    setError(null)
    try {
      // Append new note to existing notes
      const combinedNotes = existingNotes
        ? `${existingNotes}\n\n${note.trim()}`
        : note.trim()

      const result = await updateListItem({
        listItemId,
        notes: combinedNotes,
      })
      if (result.success) {
        setSuccess(true)
        addSystemMessage('Anteckning tillagd')
      } else {
        setError(result.error ?? 'Kunde inte lägga till anteckning')
      }
    } catch {
      setError('Ett oväntat fel uppstod')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    addSystemMessage('Användaren avbröt åtgärden.')
    closeDetail()
  }

  // Success state
  if (success) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" />
          <span className="text-sm font-medium">Anteckning tillagd</span>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          {lawTitle && <p className="text-sm font-medium">{lawTitle}</p>}
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {note}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <a href="/app/laglista">
            Visa i laglistan
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      </div>
    )
  }

  // Edit form
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{data.preview}</p>

      {lawTitle && <p className="text-sm font-medium">{lawTitle}</p>}

      {existingNotes && (
        <div>
          <span className="text-xs text-muted-foreground mb-1 block">
            Befintliga anteckningar
          </span>
          <div className="rounded-lg border border-border bg-muted/20 p-2.5">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {existingNotes}
            </p>
          </div>
        </div>
      )}

      <div>
        <span className="text-xs text-muted-foreground mb-1 block">
          Ny anteckning
        </span>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="text-sm min-h-[100px] resize-none"
          placeholder="Skriv din anteckning..."
          autoFocus
        />
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleConfirm} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          Bekräfta
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={saving}
        >
          <X className="h-4 w-4 mr-1" />
          Avbryt
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
