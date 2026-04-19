'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Search, X, Filter } from 'lucide-react'
import { WorkspaceDocumentType, WorkspaceDocumentStatus } from '@prisma/client'

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  POLICY: 'Policy',
  RISK_ASSESSMENT: 'Riskbedömning',
  ACTION_PLAN: 'Handlingsplan',
  PROCEDURE: 'Rutin',
  INSTRUCTION: 'Instruktion',
  CHECKLIST: 'Checklista',
  REPORT: 'Rapport',
  OTHER: 'Övrigt',
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Utkast',
  IN_REVIEW: 'Under granskning',
  APPROVED: 'Godkänd',
  SUPERSEDED: 'Ersatt',
  ARCHIVED: 'Arkiverad',
}

export interface DocumentFilters {
  search: string
  types: string[]
  statuses: string[]
}

interface DocumentFiltersProps {
  filters: DocumentFilters
  onFiltersChange: (_filters: DocumentFilters) => void
  hideStatusFilter?: boolean
  excludeStatuses?: string[] | undefined
}

export function DocumentFilterControls({
  filters,
  onFiltersChange,
  hideStatusFilter,
  excludeStatuses,
}: DocumentFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFiltersChange({ ...filters, search: searchInput })
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchInput, filters, onFiltersChange])

  const toggleType = useCallback(
    (type: string, checked: boolean) => {
      const types = checked
        ? [...filters.types, type]
        : filters.types.filter((t) => t !== type)
      onFiltersChange({ ...filters, types })
    },
    [filters, onFiltersChange]
  )

  const toggleStatus = useCallback(
    (status: string, checked: boolean) => {
      const statuses = checked
        ? [...filters.statuses, status]
        : filters.statuses.filter((s) => s !== status)
      onFiltersChange({ ...filters, statuses })
    },
    [filters, onFiltersChange]
  )

  const hasActiveFilters =
    filters.search.length > 0 ||
    filters.types.length > 0 ||
    filters.statuses.length > 0

  const clearAll = useCallback(() => {
    setSearchInput('')
    onFiltersChange({ search: '', types: [], statuses: [] })
  }, [onFiltersChange])

  return (
    <>
      {/* Search */}
      <div className="relative w-64">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Sök dokument..."
          className="h-9 pl-9 text-sm"
        />
      </div>

      {/* Type multi-select */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1">
            <Filter className="h-3.5 w-3.5" />
            Dokumenttyp
            {filters.types.length > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 py-0 text-[10px] text-primary-foreground">
                {filters.types.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start">
          <div className="space-y-2">
            {Object.values(WorkspaceDocumentType).map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Checkbox
                  checked={filters.types.includes(type)}
                  onCheckedChange={(checked) => toggleType(type, !!checked)}
                />
                <span className="text-sm">
                  {DOCUMENT_TYPE_LABELS[type] ?? type}
                </span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Status multi-select */}
      {!hideStatusFilter && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1">
              <Filter className="h-3.5 w-3.5" />
              Status
              {filters.statuses.length > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 py-0 text-[10px] text-primary-foreground">
                  {filters.statuses.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-3" align="start">
            <div className="space-y-2">
              {Object.values(WorkspaceDocumentStatus)
                .filter((s) => !excludeStatuses?.includes(s))
                .map((status) => (
                  <label
                    key={status}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={filters.statuses.includes(status)}
                      onCheckedChange={(checked) =>
                        toggleStatus(status, !!checked)
                      }
                    />
                    <span className="text-sm">
                      {STATUS_LABELS[status] ?? status}
                    </span>
                  </label>
                ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
            Rensa filter
          </Button>
        </>
      )}
    </>
  )
}
