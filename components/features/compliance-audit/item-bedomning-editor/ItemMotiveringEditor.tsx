'use client'

/** Story 21.5 — click-to-edit motivering textarea for ComplianceAuditItem rows. */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const MAX_LENGTH = 5000
const DEBOUNCE_MS = 2000

interface ItemMotiveringEditorProps {
  value: string | null
  onChange: (_next: string | null) => Promise<void>
  disabled?: boolean
  readOnly?: boolean
  className?: string
}

export function ItemMotiveringEditor({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  className,
}: ItemMotiveringEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<string>(value ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Keep draft in sync when server value changes (e.g. optimistic reconcile).
  useEffect(() => {
    if (!isEditing) {
      setDraft(value ?? '')
    }
  }, [value, isEditing])

  const save = useCallback(
    async (text: string) => {
      const normalised = text.trim().length === 0 ? null : text
      if (normalised === (value ?? null)) return
      setIsSaving(true)
      try {
        await onChange(normalised)
      } finally {
        setIsSaving(false)
      }
    },
    [onChange, value]
  )

  const debouncedSave = useDebouncedCallback(save, DEBOUNCE_MS)

  const enterEdit = () => {
    if (disabled || readOnly) return
    setIsEditing(true)
    // Focus after React commits the textarea.
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const handleBlur = async (e: React.FocusEvent<HTMLTextAreaElement>) => {
    // Cancel any pending debounced save — we save once on blur.
    debouncedSave.cancel()
    // Read from the DOM rather than the `draft` closure — under rapid
    // change+blur sequences (also common in test harnesses), the closure
    // value can lag behind the element's current value.
    await save(e.target.value)
    setIsEditing(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value
    setDraft(next)
    debouncedSave(next)
  }

  // Read-only: plain paragraph, no interaction.
  if (readOnly) {
    return (
      <p
        className={cn(
          'whitespace-pre-wrap text-sm text-muted-foreground',
          !value && 'italic',
          className
        )}
      >
        {value ?? '—'}
      </p>
    )
  }

  if (isEditing) {
    return (
      <div className={cn('relative', className)}>
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={handleChange}
          onBlur={handleBlur}
          maxLength={MAX_LENGTH}
          rows={3}
          disabled={disabled}
          aria-label="Motivering"
          aria-describedby="motivering-help"
          className="min-h-[80px] resize-y text-sm"
        />
        {isSaving ? (
          <Loader2
            className="absolute bottom-2 right-2 h-3.5 w-3.5 animate-spin text-muted-foreground"
            aria-label="Sparar"
          />
        ) : null}
        <span id="motivering-help" className="sr-only">
          Max {MAX_LENGTH} tecken. Sparas automatiskt vid inaktivitet eller när
          du lämnar fältet.
        </span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={enterEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          enterEdit()
        }
      }}
      disabled={disabled}
      aria-label="Redigera motivering"
      className={cn(
        'block w-full cursor-text rounded-sm px-2 py-1 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        !value && 'italic text-muted-foreground',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <span className="line-clamp-2 whitespace-pre-wrap">
        {value || 'Lägg till motivering…'}
      </span>
    </button>
  )
}
