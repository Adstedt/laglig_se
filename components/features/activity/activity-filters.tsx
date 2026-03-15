'use client'

/**
 * Story 6.10: Activity Log Filters
 * Filter bar for the workspace activity log page
 */

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getWorkspaceMembers } from '@/app/actions/tasks'
import {
  type ActivityFilters as FilterState,
  parseActivityFiltersFromUrl,
  serializeActivityFiltersToUrl,
} from '@/lib/utils/activity-filter-params'

interface Member {
  id: string
  name: string | null
  email: string
}

interface ActivityFiltersProps {
  onFiltersChange: (_filters: FilterState) => void
}

const ENTITY_TYPES = [
  { value: 'list_item', label: 'Lagpost' },
  { value: 'task', label: 'Uppgift' },
  { value: 'comment', label: 'Kommentar' },
  { value: 'evidence', label: 'Bevis' },
]

export function ActivityFilters({ onFiltersChange }: ActivityFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [members, setMembers] = useState<Member[]>([])
  const [filters, setFilters] = useState<FilterState>(() =>
    parseActivityFiltersFromUrl(new URLSearchParams(searchParams.toString()))
  )

  // Fetch workspace members for user dropdown
  useEffect(() => {
    async function fetchMembers() {
      const result = await getWorkspaceMembers()
      if (result.success && result.data) {
        setMembers(
          result.data.map((m) => ({ id: m.id, name: m.name, email: m.email }))
        )
      }
    }
    fetchMembers()
  }, [])

  const updateFilters = useCallback(
    (newFilters: FilterState) => {
      setFilters(newFilters)
      onFiltersChange(newFilters)
      const params = serializeActivityFiltersToUrl(newFilters)
      const qs = params.toString()
      router.replace(qs ? `?${qs}` : '?', { scroll: false })
    },
    [onFiltersChange, router]
  )

  const clearFilters = () => {
    const empty: FilterState = {
      actionFilter: [],
      entityTypeFilter: [],
    }
    updateFilters(empty)
  }

  const hasFilters =
    !!filters.userFilter ||
    filters.actionFilter.length > 0 ||
    filters.entityTypeFilter.length > 0 ||
    !!filters.startDate ||
    !!filters.endDate

  const handleExportCsv = () => {
    const params = serializeActivityFiltersToUrl(filters)
    window.open(
      `/api/workspace/activity-log/export?${params.toString()}`,
      '_blank'
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* User filter */}
      <Select
        value={filters.userFilter ?? '_all'}
        onValueChange={(value) =>
          updateFilters({
            ...filters,
            userFilter: value === '_all' ? undefined : value,
          })
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Alla användare" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Alla användare</SelectItem>
          {members.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.name ?? member.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Entity type filter */}
      <Select
        value={filters.entityTypeFilter[0] ?? '_all'}
        onValueChange={(value) =>
          updateFilters({
            ...filters,
            entityTypeFilter: value === '_all' ? [] : [value],
          })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Alla typer" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Alla typer</SelectItem>
          {ENTITY_TYPES.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date range */}
      <Input
        type="date"
        value={filters.startDate ?? ''}
        onChange={(e) =>
          updateFilters({
            ...filters,
            startDate: e.target.value || undefined,
          })
        }
        className="w-[150px]"
        placeholder="Från datum"
      />
      <Input
        type="date"
        value={filters.endDate ?? ''}
        onChange={(e) =>
          updateFilters({
            ...filters,
            endDate: e.target.value || undefined,
          })
        }
        className="w-[150px]"
        placeholder="Till datum"
      />

      {/* Clear filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Rensa filter
        </Button>
      )}

      {/* CSV Export */}
      <Button variant="outline" size="sm" onClick={handleExportCsv}>
        <Download className="h-4 w-4 mr-1" />
        Exportera CSV
      </Button>
    </div>
  )
}
