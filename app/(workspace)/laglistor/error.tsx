'use client'

/**
 * Story 4.11: Document Lists Error Boundary
 */

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function DocumentListsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to error reporting service
    console.error('Document lists error:', error)
  }, [error])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mina laglistor</h1>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>

        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Kunde inte ladda laglistor</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Ett fel uppstod när vi försökte hämta dina laglistor. Försök igen
            eller gå till översikten.
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Försök igen
          </Button>
          <Button asChild>
            <Link href="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              Gå till översikt
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
