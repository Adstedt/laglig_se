'use client'

/**
 * Story 24.6 AC 7: Full-page empty state when the workspace has zero law
 * lists. Offers two CTAs: primary "Skapa ny lista" and secondary "eller
 * importera en lista" — the secondary path opens <ManageListModal> directly
 * on its `'import'` step.
 */

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyLawListStateProps {
  onCreateList: () => void
  onOpenImport: () => void
}

export function EmptyLawListState({
  onCreateList,
  onOpenImport,
}: EmptyLawListStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 px-6 py-16 text-center">
      <p className="text-base font-semibold">Du har inga laglistor än</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Skapa en ny lista eller importera en befintlig laglista från Excel, CSV
        eller klistra in raderna.
      </p>
      <div className="mt-2 flex flex-col items-center gap-2">
        <Button onClick={onCreateList}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Skapa ny lista
        </Button>
        <button
          type="button"
          onClick={onOpenImport}
          className="text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
        >
          eller importera en lista
        </button>
      </div>
    </div>
  )
}
