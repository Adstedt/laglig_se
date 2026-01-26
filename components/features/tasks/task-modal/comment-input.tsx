'use client'

/**
 * Story 6.6: Comment Input Box
 * Always visible comment input with avatar and quick actions
 */

import { useState, useRef, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'
import { createComment } from '@/app/actions/task-modal'
import { toast } from 'sonner'

interface CommentInputProps {
  taskId: string
  parentCommentId?: string | undefined
  currentUser?:
    | {
        name?: string | null
        email: string
        avatar_url?: string | null
      }
    | undefined
  placeholder?: string | undefined
  onSubmit?: (() => void) | undefined
  onCancel?: (() => void) | undefined
  /** Focus the textarea on mount (uses ref-based focus for accessibility) */
  focusOnMount?: boolean | undefined
}

export function CommentInput({
  taskId,
  parentCommentId,
  currentUser,
  placeholder = 'Lägg till en kommentar...',
  onSubmit,
  onCancel,
  focusOnMount = false,
}: CommentInputProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea on mount when focusOnMount is true (using ref for accessibility)
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
    const result = await createComment(taskId, trimmedContent, parentCommentId)

    if (result.success) {
      setContent('')
      onSubmit?.()
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
        {/* User Avatar */}
        <Avatar className="h-8 w-8 shrink-0">
          {currentUser?.avatar_url && (
            <AvatarImage
              src={currentUser.avatar_url}
              alt={currentUser.name ?? ''}
            />
          )}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>

        {/* Input Area */}
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

          {/* Action Buttons */}
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
