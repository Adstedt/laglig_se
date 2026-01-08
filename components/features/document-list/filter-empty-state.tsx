'use client'

/**
 * Story 6.2: Filter Empty State Component
 * Displayed when filters or search return no results
 */

import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FilterEmptyStateProps {
  searchQuery?: string
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function FilterEmptyState({
  searchQuery,
  hasActiveFilters,
  onClearFilters,
}: FilterEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Search className="h-12 w-12 text-muted-foreground mb-4" />
      {searchQuery ? (
        <>
          <h3 className="text-lg font-medium">
            Inga resultat för &quot;{searchQuery}&quot;
          </h3>
          <p className="text-muted-foreground mt-1">Försök med andra sökord</p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-medium">Inga lagar matchar filtren</h3>
          <p className="text-muted-foreground mt-1">
            Ändra eller rensa filtren för att se fler resultat
          </p>
        </>
      )}
      {hasActiveFilters && (
        <Button variant="outline" onClick={onClearFilters} className="mt-4">
          <X className="h-4 w-4 mr-2" />
          Rensa filter
        </Button>
      )}
    </div>
  )
}
