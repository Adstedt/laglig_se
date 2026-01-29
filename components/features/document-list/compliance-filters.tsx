'use client'

/**
 * Story 6.2: Compliance Filters for Table View
 * Story 6.19: Refactored status/category filters to use shared FilterPopover
 */

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { X, User } from 'lucide-react'
import type { ComplianceStatus } from '@prisma/client'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'
import { COMPLIANCE_STATUS_OPTIONS } from './table-cell-editors/compliance-status-editor'
import {
  FilterPopover,
  type FilterOption,
} from '@/components/ui/filter-popover'
import { cn } from '@/lib/utils'

export interface ComplianceFiltersState {
  complianceStatus: ComplianceStatus[]
  category: string[]
  responsibleUserId: string | null
}

interface ComplianceFiltersProps {
  filters: ComplianceFiltersState
  onFiltersChange: (_filters: ComplianceFiltersState) => void
  workspaceMembers: WorkspaceMemberOption[]
  categories: string[]
  className?: string
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  return email.substring(0, 2).toUpperCase()
}

// Map compliance status options to FilterOption format
const STATUS_FILTER_OPTIONS: FilterOption[] = COMPLIANCE_STATUS_OPTIONS.map(
  (opt) => {
    const base: FilterOption = {
      value: opt.value,
      label: opt.label,
      color: opt.color,
    }
    if (opt.strikethrough) {
      base.strikethrough = opt.strikethrough
    }
    return base
  }
)

export function ComplianceFilters({
  filters,
  onFiltersChange,
  workspaceMembers,
  categories,
  className,
}: ComplianceFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Update URL query params when filters change
  const updateUrlParams = useCallback(
    (newFilters: ComplianceFiltersState) => {
      const params = new URLSearchParams(searchParams)

      if (newFilters.complianceStatus.length > 0) {
        params.set('status', newFilters.complianceStatus.join(','))
      } else {
        params.delete('status')
      }

      if (newFilters.category.length > 0) {
        params.set('category', newFilters.category.join(','))
      } else {
        params.delete('category')
      }

      if (newFilters.responsibleUserId) {
        params.set('responsible', newFilters.responsibleUserId)
      } else {
        params.delete('responsible')
      }

      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  const handleStatusToggle = useCallback(
    (status: string) => {
      const typedStatus = status as ComplianceStatus
      const newStatuses = filters.complianceStatus.includes(typedStatus)
        ? filters.complianceStatus.filter((s) => s !== typedStatus)
        : [...filters.complianceStatus, typedStatus]

      const newFilters = { ...filters, complianceStatus: newStatuses }
      onFiltersChange(newFilters)
      updateUrlParams(newFilters)
    },
    [filters, onFiltersChange, updateUrlParams]
  )

  const handleCategoryToggle = useCallback(
    (category: string) => {
      const newCategories = filters.category.includes(category)
        ? filters.category.filter((c) => c !== category)
        : [...filters.category, category]

      const newFilters = { ...filters, category: newCategories }
      onFiltersChange(newFilters)
      updateUrlParams(newFilters)
    },
    [filters, onFiltersChange, updateUrlParams]
  )

  const handleResponsibleChange = useCallback(
    (userId: string | null) => {
      const newFilters = { ...filters, responsibleUserId: userId }
      onFiltersChange(newFilters)
      updateUrlParams(newFilters)
    },
    [filters, onFiltersChange, updateUrlParams]
  )

  const clearAllFilters = useCallback(() => {
    const newFilters: ComplianceFiltersState = {
      complianceStatus: [],
      category: [],
      responsibleUserId: null,
    }
    onFiltersChange(newFilters)
    updateUrlParams(newFilters)
  }, [onFiltersChange, updateUrlParams])

  const hasActiveFilters = useMemo(
    () =>
      filters.complianceStatus.length > 0 ||
      filters.category.length > 0 ||
      filters.responsibleUserId !== null,
    [filters]
  )

  const activeFilterCount = useMemo(
    () =>
      filters.complianceStatus.length +
      filters.category.length +
      (filters.responsibleUserId ? 1 : 0),
    [filters]
  )

  // Map categories to FilterOption format
  const categoryFilterOptions: FilterOption[] = useMemo(
    () => categories.map((c) => ({ value: c, label: c })),
    [categories]
  )

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Status filter — shared FilterPopover */}
      <FilterPopover
        label="Efterlevnadsstatus"
        options={STATUS_FILTER_OPTIONS}
        selected={filters.complianceStatus}
        onToggle={handleStatusToggle}
      />

      {/* Category filter — shared FilterPopover */}
      {categories.length > 0 && (
        <FilterPopover
          label="Kategori"
          options={categoryFilterOptions}
          selected={filters.category}
          onToggle={handleCategoryToggle}
        />
      )}

      {/* Responsible person filter - with label */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">Ansvarig:</span>
        <Select
          value={filters.responsibleUserId ?? '__all__'}
          onValueChange={(value) =>
            handleResponsibleChange(value === '__all__' ? null : value)
          }
        >
          <SelectTrigger className="w-[120px] h-8">
            <SelectValue placeholder="Alla" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-3 w-3 text-muted-foreground" />
                </div>
                <span>Alla</span>
              </div>
            </SelectItem>
            {workspaceMembers.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={member.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(member.name, member.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">
                    {member.name || member.email.split('@')[0]}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear all filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="h-8 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Rensa filter
          {activeFilterCount > 1 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      )}
    </div>
  )
}

/**
 * Parse filters from URL search params
 */
export function parseFiltersFromUrl(
  searchParams: URLSearchParams
): ComplianceFiltersState {
  const statusParam = searchParams.get('status')
  const categoryParam = searchParams.get('category')
  const responsibleParam = searchParams.get('responsible')

  return {
    complianceStatus: statusParam
      ? (statusParam.split(',') as ComplianceStatus[])
      : [],
    category: categoryParam ? categoryParam.split(',') : [],
    responsibleUserId: responsibleParam || null,
  }
}

/**
 * Check if any filters are active
 */
export function hasActiveFilters(filters: ComplianceFiltersState): boolean {
  return (
    filters.complianceStatus.length > 0 ||
    filters.category.length > 0 ||
    filters.responsibleUserId !== null
  )
}
