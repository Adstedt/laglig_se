'use client'

/**
 * Faceted filters for the /krav overview — Laglista + Ansvarig multi-select.
 *
 * These compose (AND) on top of the KravFilterChips preset + search. They
 * reuse the shared <FilterPopover> primitive (same dropdown used by the
 * laglistor compliance filters) so the krav surface stays consistent with
 * the rest of the workspace.
 */

import { useMemo } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FilterPopover,
  type FilterOption,
} from '@/components/ui/filter-popover'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'

export interface KravLawListOption {
  id: string
  name: string
}

interface KravFacetFiltersProps {
  lawLists: KravLawListOption[]
  members: WorkspaceMemberOption[]
  /** Selected law-list ids (the `laglistaIds` facet). */
  laglistaIds: string[]
  /** Selected user ids (the effective-assignee facet). */
  responsibleUserIds: string[]
  onToggleLaglista: (_id: string) => void
  onToggleResponsible: (_id: string) => void
  onClearFacets: () => void
}

export function KravFacetFilters({
  lawLists,
  members,
  laglistaIds,
  responsibleUserIds,
  onToggleLaglista,
  onToggleResponsible,
  onClearFacets,
}: KravFacetFiltersProps) {
  const laglistaOptions: FilterOption[] = useMemo(
    () => lawLists.map((l) => ({ value: l.id, label: l.name })),
    [lawLists]
  )

  const responsibleOptions: FilterOption[] = useMemo(
    () =>
      members.map((m) => ({
        value: m.id,
        label: m.name || m.email.split('@')[0] || m.email,
      })),
    [members]
  )

  const activeCount = laglistaIds.length + responsibleUserIds.length

  return (
    <div className="flex flex-wrap items-center gap-2">
      {lawLists.length > 0 && (
        <FilterPopover
          label="Laglista"
          options={laglistaOptions}
          selected={laglistaIds}
          onToggle={onToggleLaglista}
        />
      )}

      {members.length > 0 && (
        <FilterPopover
          label="Ansvarig"
          options={responsibleOptions}
          selected={responsibleUserIds}
          onToggle={onToggleResponsible}
        />
      )}

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFacets}
          className="h-8 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Rensa filter
          {activeCount > 1 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {activeCount}
            </Badge>
          )}
        </Button>
      )}
    </div>
  )
}
