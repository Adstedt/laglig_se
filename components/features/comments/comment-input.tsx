'use client'

/**
 * Story 6.9: Shared Comment Input
 * Generic comment input with avatar, extracted from task modal (Story 6.6).
 * Used by both task modal and law list item modal.
 */

import { useState, useRef, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export interface CommentInputUser {
  name?: string | null
  email: string
  avatar_url?: string | null
}

interface CommentInputProps {
  parentCommentId?: string | undefined
  currentUser?: CommentInputUser | undefined
  placeholder?: string | undefined
  onSubmit: (
    _content: string,
    _parentCommentId?: string
  ) => Promise<{ success: boolean; error?: string }>
  onCancel?: (() => void) | undefined
  onSuccess?: (() => void) | undefined
  focusOnMount?: boolean | undefined
}

export function CommentInput({
  parentCommentId,
  currentUser,
  placeholder = 'Lägg till en kommentar...',
  onSubmit,
  onCancel,
  onSuccess,
  focusOnMount = false,
}: CommentInputProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (focusOnMount && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [focusOnMount])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    const trimmedContent = content.trim()
    if (!trimmedContent || isSubmitting) return

    setIsSubmitting(true)
    const result = await onSubmit(trimmedContent, parentCommentId)

    if (result.success) {
      setContent('')
      onSuccess?.()
    } else {
      toast.error('Kunde inte skapa kommentar', { description: result.error })
    }

    setIsSubmitting(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape' && onCancel) {
      onCancel()
    }
  }

  const initials = currentUser
    ? (currentUser.name ?? currentUser.email).slice(0, 2).toUpperCase()
    : 'DU'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          {currentUser?.avatar_url && (
            <AvatarImage
              src={currentUser.avatar_url}
              alt={currentUser.name ?? ''}
            />
          )}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-2">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[80px] resize-y text-sm"
            maxLength={5000}
          />

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Tryck Enter för att skicka, Shift+Enter för ny rad
            </p>
            <div className="flex gap-2">
              {onCancel && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Avbryt
                </Button>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={!content.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="ml-1.5">Skicka</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
