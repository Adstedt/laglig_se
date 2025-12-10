'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function RattskallolError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Rättskällor page error:', error)
  }, [error])

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Något gick fel</h1>
        <p className="mb-6 max-w-md text-muted-foreground">
          Vi kunde inte ladda rättskällorna just nu. Försök igen eller kom
          tillbaka senare.
        </p>
        <div className="flex gap-4">
          <Button onClick={reset} variant="default" className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Försök igen
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Gå till startsidan</Link>
          </Button>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-muted-foreground">
            Felkod: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
