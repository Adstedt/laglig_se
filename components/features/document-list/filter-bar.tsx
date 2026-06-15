'use client'

/**
 * Collapsible filter bar for the law list page.
 * Composes ContentTypeFilter, ComplianceFilters, and GroupFilterChip
 * into a single animated panel below the toolbar.
 */

import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { ContentTypeFilter } from './content-type-filter'
import {
  ComplianceFilters,
  type ComplianceFiltersState,
} from './compliance-filters'
import { GroupFilterChip } from './group-filter-chip'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import type { ContentType } from '@prisma/client'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'

interface FilterBarProps {
  isOpen: boolean
  contentTypeFilter: ContentType[] | null
  onContentTypeChange: (_groupId: string | null) => void
  complianceFilters: ComplianceFiltersState
  onComplianceFiltersChange: (_filters: ComplianceFiltersState) => void
  workspaceMembers: WorkspaceMemberOption[]
  categories: string[]
  activeGroupFilterInfo: { name: string } | null
  onClearGroupFilter: () => void
  activeFilterCount: number
  onClearAll: () => void
}

export function FilterBar({
  isOpen,
  contentTypeFilter,
  onContentTypeChange,
  complianceFilters,
  onComplianceFiltersChange,
  workspaceMembers,
  categories,
  activeGroupFilterInfo,
  onClearGroupFilter,
  activeFilterCount,
  onClearAll,
}: FilterBarProps) {
  return (
    <Collapsible open={isOpen}>
      {/* -mt-4 lives on CollapsibleContent (not the inner div) so the whole
          overflow-hidden clip box shifts up with it; on the inner div it would
          push chips past the clip edge and shear their rounded corners. */}
      <CollapsibleContent className="-mt-4">
        <div className="py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <ContentTypeFilter
              activeFilter={contentTypeFilter}
              onFilterChange={onContentTypeChange}
            />

            {/* Subtle divider between content type and compliance filters */}
            <div className="h-5 w-px bg-border/60 hidden sm:block" />

            <ComplianceFilters
              filters={complianceFilters}
              onFiltersChange={onComplianceFiltersChange}
              workspaceMembers={workspaceMembers}
              categories={categories}
            />

            {activeGroupFilterInfo && (
              <GroupFilterChip
                groupName={activeGroupFilterInfo.name}
                onClear={onClearGroupFilter}
              />
            )}

            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
                Rensa ({activeFilterCount})
              </Button>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
