'use client'

/**
 * Story 3.3: Chat Input Component
 * Input field with send button and character limit
 */

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAX_MESSAGE_LENGTH = 2000
const SHOW_COUNTER_THRESHOLD = 1500

interface ChatInputProps {
  onSend: (_message: string) => void
  disabled?: boolean
  isLoading?: boolean
  placeholder?: string
  className?: string
}

export function ChatInput({
  onSend,
  disabled = false,
  isLoading = false,
  placeholder = 'Skriv din fråga...',
  className,
}: ChatInputProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const trimmedInput = input.trim()
  const isOverLimit = input.length > MAX_MESSAGE_LENGTH
  const showCounter = input.length > SHOW_COUNTER_THRESHOLD
  const canSend =
    trimmedInput.length > 0 && !isOverLimit && !disabled && !isLoading

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSend) return

    onSend(trimmedInput)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend) {
        onSend(trimmedInput)
        setInput('')
      }
    }
  }

  // Focus input on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  return (
    <form onSubmit={handleSubmit} className={cn('border-t p-3', className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              'min-h-[60px] max-h-[120px] resize-none text-sm pr-12',
              isOverLimit && 'border-destructive focus-visible:ring-destructive'
            )}
            disabled={disabled || isLoading}
            maxLength={MAX_MESSAGE_LENGTH + 100} // Allow some overage for UX
            aria-label="Meddelande till AI"
            data-testid="chat-input"
          />
          {showCounter && (
            <span
              className={cn(
                'absolute bottom-2 right-2 text-xs',
                isOverLimit ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {input.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>
        <Button
          type="submit"
          size="sm"
          className="h-auto px-3 self-end"
          disabled={!canSend}
          aria-label="Skicka meddelande"
          data-testid="chat-send-button"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        Tryck Enter för att skicka
      </p>
    </form>
  )
}
