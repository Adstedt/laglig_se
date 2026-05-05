'use client'

/**
 * Story 3.3: Chat Error Component
 * Displays error messages with retry functionality
 *
 * Story 5.5c: added `quota_exceeded` branch — when the chat route returns
 * 402 with code AI_TOKEN_QUOTA_EXCEEDED, the user has hit their AI token
 * hard cap (2× included quota for the tier). Retry won't help; surface
 * the upgrade path instead.
 */

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { AlertCircle, ArrowUpRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ChatErrorProps {
  error: Error | null
  onRetry: () => void
  retryAfter?: number | undefined // seconds
  className?: string
}

// Swedish error messages
const ERROR_MESSAGES = {
  network: 'Kunde inte ansluta till servern. Kontrollera din anslutning.',
  timeout: 'Förfrågan tog för lång tid. Försök igen.',
  rate_limit: 'För många förfrågningar. Vänta {seconds} sekunder.',
  server_error: 'Något gick fel. Försök igen senare.',
  unauthorized: 'Din session har gått ut. Logga in igen.',
  quota_exceeded:
    'Du har använt månadens AI-frågor. Uppgradera planen för att ställa fler.',
  default: 'Ett oväntat fel uppstod. Försök igen.',
} as const

type ErrorType = keyof typeof ERROR_MESSAGES

export function ChatError({
  error,
  onRetry,
  retryAfter,
  className,
}: ChatErrorProps) {
  const [countdown, setCountdown] = useState(retryAfter ?? 0)

  // Handle countdown for rate limiting
  useEffect(() => {
    if (retryAfter && retryAfter > 0) {
      setCountdown(retryAfter)
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [retryAfter])

  // Auto-retry when countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && retryAfter && retryAfter > 0) {
      onRetry()
    }
  }, [countdown, retryAfter, onRetry])

  const errorType = getErrorType(error)
  let message: string = ERROR_MESSAGES[errorType]

  // Replace {seconds} placeholder for rate limit message
  if (errorType === 'rate_limit' && countdown > 0) {
    message = message.replace('{seconds}', countdown.toString())
  }

  const isRateLimited = errorType === 'rate_limit' && countdown > 0
  const isQuotaExceeded = errorType === 'quota_exceeded'

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 p-4 text-center max-w-[320px]',
        className
      )}
      role="alert"
      data-testid="chat-error"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>

      <p className="text-sm text-muted-foreground">{message}</p>

      {isRateLimited ? (
        <CountdownButton seconds={countdown} />
      ) : isQuotaExceeded ? (
        <Button
          asChild
          variant="default"
          size="sm"
          className="gap-2"
          data-testid="chat-upgrade-button"
        >
          <Link href="/settings?tab=billing">
            Uppgradera plan
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="gap-2"
          data-testid="chat-retry-button"
        >
          <RefreshCw className="h-4 w-4" />
          Försök igen
        </Button>
      )}
    </div>
  )
}

function CountdownButton({ seconds }: { seconds: number }) {
  return (
    <Button variant="outline" size="sm" disabled className="gap-2">
      <RefreshCw className="h-4 w-4 animate-spin" />
      Väntar... {seconds}s
    </Button>
  )
}

function getErrorType(error: Error | null): ErrorType {
  if (!error) return 'default'

  const message = (error.message ?? '').toLowerCase()

  // Story 5.5c: 402 + AI_TOKEN_QUOTA_EXCEEDED. The AI SDK can surface this
  // as the JSON body, statusText, or the raw status — match all common
  // shapes so we don't fall through to the generic "try again" branch.
  if (
    message.includes('ai_token_quota_exceeded') ||
    message.includes('tokenkvot') ||
    message.includes('402') ||
    message.includes('payment required')
  ) {
    return 'quota_exceeded'
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'network'
  }
  if (message.includes('timeout') || message.includes('aborted')) {
    return 'timeout'
  }
  if (message.includes('rate') || message.includes('429')) {
    return 'rate_limit'
  }
  if (message.includes('401') || message.includes('unauthorized')) {
    return 'unauthorized'
  }
  if (message.includes('500') || message.includes('server')) {
    return 'server_error'
  }

  return 'default'
}
