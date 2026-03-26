'use client'

/**
 * Story 14.15b, Task 2: Task creation write preview card.
 * Pre-filled form from agent's create_task(execute: false) response.
 * User can edit fields and confirm directly via server action.
 */

import { useState } from 'react'
import { Check, Loader2, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { createTask } from '@/app/actions/tasks'
import { useChatDetail } from '@/lib/ai/chat-detail-context'
import type { WriteToolResponse } from '@/lib/agent/tools/types'
import type { TaskPriority } from '@prisma/client'

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'LOW', label: 'Låg' },
  { value: 'MEDIUM', label: 'Medel' },
  { value: 'HIGH', label: 'Hög' },
  { value: 'CRITICAL', label: 'Kritisk' },
]

const PRIORITY_VARIANT: Record<
  TaskPriority,
  'secondary' | 'default' | 'destructive' | 'outline'
> = {
  LOW: 'secondary',
  MEDIUM: 'default',
  HIGH: 'destructive',
  CRITICAL: 'destructive',
}

interface WritePreviewTaskProps {
  data: WriteToolResponse<unknown>
}

export function WritePreviewTask({ data }: WritePreviewTaskProps) {
  const { closeDetail, addSystemMessage } = useChatDetail()
  const params = data.params ?? {}

  const [title, setTitle] = useState((params.title as string) ?? '')
  const [description, setDescription] = useState(
    (params.description as string) ?? ''
  )
  const [priority, setPriority] = useState<TaskPriority>(
    (params.priority as TaskPriority) ?? 'MEDIUM'
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null)

  const relatedDoc = params.relatedDocument as string | undefined
  const linkedListItemIds = params.linkedListItemIds as string[] | undefined

  const handleConfirm = async () => {
    if (!title.trim()) {
      setError('Titel krävs')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        linkedListItemIds,
      })
      if (result.success && result.data) {
        setCreatedTaskId(result.data.id)
        addSystemMessage(`Uppgift skapad: ${title.trim()}`)
      } else {
        setError(result.error ?? 'Kunde inte skapa uppgiften')
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
  if (createdTaskId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" />
          <span className="text-sm font-medium">Uppgift skapad</span>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-medium">{title}</p>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          <Badge variant={PRIORITY_VARIANT[priority]}>
            {PRIORITY_OPTIONS.find((o) => o.value === priority)?.label}
          </Badge>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <a href="/app/kanban">
            Visa uppgift
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

      <div className="space-y-3">
        <div>
          <span className="text-xs text-muted-foreground mb-1 block">
            Titel
          </span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-sm"
            autoFocus
          />
        </div>

        <div>
          <span className="text-xs text-muted-foreground mb-1 block">
            Beskrivning
          </span>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="text-sm min-h-[80px] resize-none"
            placeholder="Valfritt..."
          />
        </div>

        <div>
          <span className="text-xs text-muted-foreground mb-1 block">
            Prioritet
          </span>
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as TaskPriority)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {relatedDoc && (
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">
              Relaterat dokument
            </span>
            <p className="text-sm">{relatedDoc}</p>
          </div>
        )}
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
