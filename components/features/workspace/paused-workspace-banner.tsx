'use client'

import { Button } from '@/components/ui/button'

interface PausedWorkspaceBannerProps {
  isOwner: boolean
}

export function PausedWorkspaceBanner({ isOwner }: PausedWorkspaceBannerProps) {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
      {isOwner ? (
        <>
          Ditt workspace är pausat.{' '}
          <Button variant="link" className="h-auto p-0 text-amber-800">
            Återaktivera
          </Button>
        </>
      ) : (
        'Ditt workspace är pausat. Kontakta ägaren för att återaktivera.'
      )}
    </div>
  )
}
