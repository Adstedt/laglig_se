'use client'

/**
 * Story 16.4, Task 7 (AC: 28-30)
 * Button to re-generate law list with confirmation dialog.
 */

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { regenerateLawList } from '@/app/actions/workspace'

export function RegenerateLawListButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleRegenerate = async () => {
    setIsLoading(true)
    try {
      const result = await regenerateLawList()
      if (!result.success) {
        console.error('Regeneration failed:', result.error)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
          />
          Generera om laglista
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Generera om laglista?</AlertDialogTitle>
          <AlertDialogDescription>
            Detta ersätter din nuvarande laglista. Ändringar du gjort behålls
            inte. Den befintliga listan arkiveras.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Avbryt</AlertDialogCancel>
          <AlertDialogAction onClick={handleRegenerate}>
            Generera om
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
