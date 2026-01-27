'use client'

/**
 * Message Actions Component
 * Copy, upvote/downvote buttons for AI responses
 */

import { useState } from 'react'
import { Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { track } from '@vercel/analytics'

interface MessageActionsProps {
  messageId: string
  content: string
  className?: string
}

export function MessageActions({
  messageId,
  content,
  className,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      track('ai_chat_copy', { messageId })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleFeedback = (type: 'up' | 'down') => {
    const newFeedback = feedback === type ? null : type
    setFeedback(newFeedback)

    if (newFeedback) {
      track('ai_chat_feedback', {
        messageId,
        feedback: newFeedback,
      })
      // TODO: Send feedback to server for model improvement
    }
  }

  return (
    <div className={cn('flex items-center gap-1 mt-2', className)}>
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className={cn(
          'p-1.5 rounded-lg transition-colors',
          'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted',
          copied && 'text-green-600 hover:text-green-600'
        )}
        aria-label={copied ? 'Kopierat' : 'Kopiera'}
        title={copied ? 'Kopierat!' : 'Kopiera svar'}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Upvote button */}
      <button
        onClick={() => handleFeedback('up')}
        className={cn(
          'p-1.5 rounded-lg transition-colors',
          'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted',
          feedback === 'up' &&
            'text-green-600 hover:text-green-600 bg-green-50 dark:bg-green-950'
        )}
        aria-label="Bra svar"
        aria-pressed={feedback === 'up'}
        title="Bra svar"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>

      {/* Downvote button */}
      <button
        onClick={() => handleFeedback('down')}
        className={cn(
          'p-1.5 rounded-lg transition-colors',
          'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted',
          feedback === 'down' &&
            'text-red-600 hover:text-red-600 bg-red-50 dark:bg-red-950'
        )}
        aria-label="Dåligt svar"
        aria-pressed={feedback === 'down'}
        title="Dåligt svar"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
