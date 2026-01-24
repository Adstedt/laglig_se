'use client'

/**
 * Story P.4: Offline Fallback Page
 *
 * Displayed when the user is offline and the requested page is not cached.
 */

import { WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function OfflinePage() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <WifiOff className="h-10 w-10 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Du är offline</h1>
        <p className="max-w-md text-muted-foreground">
          Det verkar som att du inte har någon internetanslutning. Kontrollera
          din anslutning och försök igen.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => window.location.reload()} variant="default">
          Försök igen
        </Button>
        <Button onClick={() => window.history.back()} variant="outline">
          Gå tillbaka
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Sidor du tidigare har besökt kan fortfarande vara tillgängliga.
      </p>
    </div>
  )
}

// Note: Metadata must be in a server component (layout.tsx) for client components
