'use client'

/**
 * Story 6.6: Task Title Editor
 * Inline editable title with auto-save on blur
 */

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateTaskTitle } from '@/app/actions/task-modal'
import { toast } from 'sonner'

interface TaskTitleEditorProps {
  taskId: string
  initialTitle: string
  onUpdate: () => Promise<void>
  onOptimisticChange?: ((_title: string) => void) | undefined
}

type SaveStatus = 'idle' | 'saving' | 'saved'

export function TaskTitleEditor({
  taskId,
  initialTitle,
  onUpdate,
  onOptimisticChange,
}: TaskTitleEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Update local state when initialTitle changes
  useEffect(() => {
    setTitle(initialTitle)
  }, [initialTitle])

  const handleSave = async () => {
    const trimmedTitle = title.trim()

    // Validate minimum length
    if (trimmedTitle.length < 3) {
      toast.error('Titeln måste vara minst 3 tecken')
      setTitle(initialTitle)
      setIsEditing(false)
      return
    }

    // Skip save if unchanged
    if (trimmedTitle === initialTitle) {
      setIsEditing(false)
      return
    }

    setIsEditing(false)
    setSaveStatus('saving')

    // Optimistic update
    onOptimisticChange?.(trimmedTitle)

    // Server update
    const result = await updateTaskTitle(taskId, trimmedTitle)

    if (result.success) {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } else {
      toast.error('Fel', { description: result.error })
      setTitle(initialTitle)
      setSaveStatus('idle')
      // Revert optimistic update
      await onUpdate()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setTitle(initialTitle)
      setIsEditing(false)
    }
  }

  return (
    <div className="relative">
      {isEditing ? (
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="text-xl font-semibold h-auto py-1 px-2 -ml-2"
          maxLength={200}
        />
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className={cn(
            'text-xl font-semibold text-left w-full py-1 px-2 -ml-2 rounded-md',
            'hover:bg-muted/50 transition-colors cursor-text',
            'focus:outline-none focus:ring-2 focus:ring-ring'
          )}
          type="button"
        >
          {title}
        </button>
      )}

      {/* Save status indicator */}
      {saveStatus !== 'idle' && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Sparar...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check className="h-3 w-3 text-green-500" />
              <span>Sparat</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
