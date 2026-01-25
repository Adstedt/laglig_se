'use client'

/**
 * Story 6.6: Labels Box
 * Tag input for custom task labels
 */

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, Plus, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateTaskLabels } from '@/app/actions/task-modal'
import { toast } from 'sonner'

interface LabelsBoxProps {
  taskId: string
  labels: string[]
  onUpdate: () => Promise<void>
}

const MAX_LABELS = 10
const MAX_LABEL_LENGTH = 50

// Predefined label colors for visual variety
const LABEL_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-yellow-100 text-yellow-700 border-yellow-200',
  'bg-red-100 text-red-700 border-red-200',
]

function getLabelColor(label: string): string {
  // Generate consistent color based on label string
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash)
  }
  return (
    LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length] ?? LABEL_COLORS[0] ?? ''
  )
}

export function LabelsBox({ taskId, labels, onUpdate }: LabelsBoxProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAddLabel = async () => {
    const trimmed = newLabel.trim()

    if (!trimmed) {
      setIsAdding(false)
      setNewLabel('')
      return
    }

    if (trimmed.length > MAX_LABEL_LENGTH) {
      toast.error(`Max ${MAX_LABEL_LENGTH} tecken per etikett`)
      return
    }

    if (labels.includes(trimmed)) {
      toast.error('Etiketten finns redan')
      return
    }

    if (labels.length >= MAX_LABELS) {
      toast.error(`Max ${MAX_LABELS} etiketter`)
      return
    }

    setIsSaving(true)
    const result = await updateTaskLabels(taskId, [...labels, trimmed])

    if (result.success) {
      setNewLabel('')
      setIsAdding(false)
      await onUpdate()
    } else {
      toast.error('Kunde inte lägga till etikett', {
        description: result.error,
      })
    }

    setIsSaving(false)
  }

  const handleRemoveLabel = async (labelToRemove: string) => {
    setIsSaving(true)
    const result = await updateTaskLabels(
      taskId,
      labels.filter((l) => l !== labelToRemove)
    )

    if (result.success) {
      await onUpdate()
    } else {
      toast.error('Kunde inte ta bort etikett', { description: result.error })
    }

    setIsSaving(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddLabel()
    } else if (e.key === 'Escape') {
      setIsAdding(false)
      setNewLabel('')
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">
            Etiketter
          </CardTitle>
          {!isAdding && labels.length < MAX_LABELS && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => {
                setIsAdding(true)
                setTimeout(() => inputRef.current?.focus(), 0)
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {/* Existing labels */}
          {labels.map((label) => (
            <Badge
              key={label}
              variant="outline"
              className={cn(
                'gap-1 pr-1 transition-opacity',
                getLabelColor(label),
                isSaving && 'opacity-50'
              )}
            >
              {label}
              <button
                onClick={() => handleRemoveLabel(label)}
                disabled={isSaving}
                className="ml-1 rounded-full hover:bg-black/10 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          {/* Add new label input */}
          {isAdding && (
            <div className="flex items-center gap-1">
              <Input
                ref={inputRef}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleAddLabel}
                placeholder="Ny etikett..."
                className="h-6 w-24 text-xs px-2"
                maxLength={MAX_LABEL_LENGTH}
                disabled={isSaving}
              />
            </div>
          )}

          {/* Empty state */}
          {labels.length === 0 && !isAdding && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1 w-full justify-center">
              <Tag className="h-3 w-3" />
              Inga etiketter
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
