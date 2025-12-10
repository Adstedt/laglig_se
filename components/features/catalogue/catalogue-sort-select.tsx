'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Nyast först' },
  { value: 'date_asc', label: 'Äldst först' },
  { value: 'title', label: 'Titel (A-Ö)' },
  { value: 'relevance', label: 'Relevans' },
]

interface CatalogueSortSelectProps {
  currentSort: string
  basePath: string
}

export function CatalogueSortSelect({
  currentSort,
  basePath,
}: CatalogueSortSelectProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSortChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === 'date_desc') {
        params.delete('sort')
      } else {
        params.set('sort', value)
      }
      // Reset to page 1 when sorting changes
      params.delete('page')
      router.push(`${basePath}?${params.toString()}`)
    },
    [router, searchParams, basePath]
  )

  return (
    <Select value={currentSort} onValueChange={handleSortChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder="Sortera" />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
