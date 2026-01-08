'use client'

/**
 * Story 6.2: Compliance Filters for Table View
 * Filters for status, category, and responsible person with URL persistence
 */

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, X, User } from 'lucide-react'
import type { ComplianceStatus } from '@prisma/client'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'
import { COMPLIANCE_STATUS_OPTIONS } from './table-cell-editors/compliance-status-editor'
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
    (status: ComplianceStatus) => {
      const newStatuses = filters.complianceStatus.includes(status)
        ? filters.complianceStatus.filter((s) => s !== status)
        : [...filters.complianceStatus, status]

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

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Status filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            Efterlevnadsstatus
            {filters.complianceStatus.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {filters.complianceStatus.length}
              </Badge>
            )}
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="space-y-1">
            {COMPLIANCE_STATUS_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={filters.complianceStatus.includes(option.value)}
                  onCheckedChange={() => handleStatusToggle(option.value)}
                />
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                    option.color,
                    option.strikethrough && 'line-through'
                  )}
                >
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Category filter */}
      {categories.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              Kategori
              {filters.category.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {filters.category.length}
                </Badge>
              )}
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1 max-h-60 overflow-auto">
              {categories.map((category) => (
                <label
                  key={category}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={filters.category.includes(category)}
                    onCheckedChange={() => handleCategoryToggle(category)}
                  />
                  <span className="text-sm">{category}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
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
