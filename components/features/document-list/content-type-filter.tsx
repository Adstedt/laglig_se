'use client'

/**
 * Story 4.11: Content Type Filter
 * Filter chips for filtering documents by type
 */

import { CONTENT_TYPE_GROUPS } from '@/lib/utils/content-type'
import { FilterChip, FilterChipGroup } from '@/components/ui/filter-chip'
import type { ContentType } from '@prisma/client'

interface ContentTypeFilterProps {
  activeFilter: ContentType[] | null
  onFilterChange: (_groupId: string | null) => void
}

export function ContentTypeFilter({
  activeFilter,
  onFilterChange,
}: ContentTypeFilterProps) {
  const activeGroupId = getActiveGroupId(activeFilter)

  return (
    <FilterChipGroup aria-label="Filtrera dokument efter typ">
      <FilterChip
        pressed={activeGroupId === 'all'}
        onPressedChange={() => onFilterChange(null)}
      >
        Alla
      </FilterChip>
      {CONTENT_TYPE_GROUPS.map((group) => (
        <FilterChip
          key={group.id}
          pressed={activeGroupId === group.id}
          onPressedChange={() => onFilterChange(group.id)}
        >
          {group.labelPlural}
        </FilterChip>
      ))}
    </FilterChipGroup>
  )
}

function getActiveGroupId(filter: ContentType[] | null): string {
  if (!filter || filter.length === 0) return 'all'

  for (const group of CONTENT_TYPE_GROUPS) {
    if (
      group.types.length === filter.length &&
      group.types.every((t) => filter.includes(t))
    ) {
      return group.id
    }
  }

  return 'all'
}
