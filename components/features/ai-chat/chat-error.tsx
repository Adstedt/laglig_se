'use client'

/**
 * Story 3.3: Chat Error Component
 * Displays error messages with retry functionality
 */

import { useState, useEffect } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
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

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 p-4 text-center max-w-[280px]',
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
