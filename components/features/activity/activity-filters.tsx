'use client'

/**
 * Story 6.10 + activity-log revamp: Filter bar for the workspace activity log page.
 * Category filter is primary; entity type retained as a secondary narrowing.
 */

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
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
import { getWorkspaceMembers } from '@/app/actions/tasks'
import {
  type ActivityFilters as FilterState,
  parseActivityFiltersFromUrl,
  serializeActivityFiltersToUrl,
} from '@/lib/utils/activity-filter-params'
import { ACTIVITY_CATEGORIES, CATEGORY_META } from '@/lib/activity/categories'
import type { ActivityCategory } from '@/lib/activity/types'
import { cn } from '@/lib/utils'

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
  { value: 'workspace_document', label: 'Styrdokument' },
  { value: 'requirement', label: 'Kravpunkt' },
  { value: 'email', label: 'E-post' },
  // Story 21.13: compliance-audit entities.
  { value: 'compliance_audit_cycle', label: 'Lagefterlevnadskontroll' },
  { value: 'compliance_audit_item', label: 'Kontrollpost' },
  {
    value: 'compliance_finding',
    label: 'Avvikelse / Observation / Förbättring',
  },
]

export function ActivityFilters({ onFiltersChange }: ActivityFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [members, setMembers] = useState<Member[]>([])
  const [filters, setFilters] = useState<FilterState>(() =>
    parseActivityFiltersFromUrl(new URLSearchParams(searchParams.toString()))
  )

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
      categoryFilter: [],
    }
    updateFilters(empty)
  }

  const hasFilters =
    !!filters.userFilter ||
    filters.actionFilter.length > 0 ||
    filters.entityTypeFilter.length > 0 ||
    filters.categoryFilter.length > 0 ||
    !!filters.startDate ||
    !!filters.endDate

  const startDate = filters.startDate ? parseISO(filters.startDate) : undefined
  const endDate = filters.endDate ? parseISO(filters.endDate) : undefined

  return (
    <div className="border-b border-border/60">
      <div className="flex items-center gap-2 py-2 flex-wrap">
        {/* Category filter (single-select; the backend accepts multiple) */}
        <Select
          value={filters.categoryFilter[0] ?? '_all'}
          onValueChange={(value) =>
            updateFilters({
              ...filters,
              categoryFilter:
                value === '_all' ? [] : [value as ActivityCategory],
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Alla kategorier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Alla kategorier</SelectItem>
            {ACTIVITY_CATEGORIES.map((category) => {
              const meta = CATEGORY_META[category]
              const Icon = meta.icon
              return (
                <SelectItem key={category} value={category}>
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

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

        {/* Entity type filter (secondary narrowing) */}
        <Select
          value={filters.entityTypeFilter[0] ?? '_all'}
          onValueChange={(value) =>
            updateFilters({
              ...filters,
              entityTypeFilter: value === '_all' ? [] : [value],
            })
          }
        >
          {/* Story 21.13: widened from w-[160px] to w-[220px] to accommodate
              the longest compliance-audit label ("Avvikelse / Observation /
              Förbättring", 36 chars) without truncation. */}
          <SelectTrigger className="w-[220px]">
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
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'h-9 w-[150px] justify-start text-left font-normal',
                !startDate && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
              {startDate ? format(startDate, 'yyyy-MM-dd') : 'Från datum'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={(date) =>
                updateFilters({
                  ...filters,
                  startDate: date ? format(date, 'yyyy-MM-dd') : undefined,
                })
              }
              locale={sv}
              initialFocus
            />
            {startDate && (
              <div className="border-t p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    updateFilters({ ...filters, startDate: undefined })
                  }
                >
                  <X className="h-4 w-4 mr-2" />
                  Rensa datum
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'h-9 w-[150px] justify-start text-left font-normal',
                !endDate && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
              {endDate ? format(endDate, 'yyyy-MM-dd') : 'Till datum'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={(date) =>
                updateFilters({
                  ...filters,
                  endDate: date ? format(date, 'yyyy-MM-dd') : undefined,
                })
              }
              locale={sv}
              initialFocus
            />
            {endDate && (
              <div className="border-t p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    updateFilters({ ...filters, endDate: undefined })
                  }
                >
                  <X className="h-4 w-4 mr-2" />
                  Rensa datum
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
              Rensa filter
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
