'use client'

/**
 * Story 4.11: Content Type Filter
 * Filter chips for filtering documents by type
 */

import { CONTENT_TYPE_GROUPS } from '@/lib/utils/content-type'
import { cn } from '@/lib/utils'
import type { ContentType } from '@prisma/client'

interface ContentTypeFilterProps {
  activeFilter: ContentType[] | null
  onFilterChange: (groupId: string | null) => void
}

export function ContentTypeFilter({
  activeFilter,
  onFilterChange,
}: ContentTypeFilterProps) {
  // Determine which group is active based on activeFilter
  const activeGroupId = getActiveGroupId(activeFilter)

  return (
    <div className="flex flex-wrap gap-2">
      <FilterChip
        label="Alla"
        isActive={activeGroupId === 'all'}
        onClick={() => onFilterChange(null)}
      />
      {CONTENT_TYPE_GROUPS.map((group) => (
        <FilterChip
          key={group.id}
          label={group.labelPlural}
          isActive={activeGroupId === group.id}
          onClick={() => onFilterChange(group.id)}
        />
      ))}
    </div>
  )
}

function FilterChip({
  label,
  isActive,
  onClick,
}: {
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-sm rounded-full border transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background hover:bg-muted border-border text-foreground'
      )}
    >
      {label}
    </button>
  )
}

function getActiveGroupId(filter: ContentType[] | null): string {
  if (!filter || filter.length === 0) return 'all'

  // Check which group matches the filter
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
