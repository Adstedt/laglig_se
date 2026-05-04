'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

import { Button } from '@/components/ui/button'
import {
  DatePicker,
  parseISODate,
  toISODate,
} from '@/components/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ErrorFiltersProps {
  jobNames: { name: string; displayName: string }[]
  currentJobName: string | null
  currentFrom: string | null
  currentTo: string | null
}

export function ErrorFilters({
  jobNames,
  currentJobName,
  currentFrom,
  currentTo,
}: ErrorFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  function handleClear() {
    router.push(pathname)
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <label
          htmlFor="job-filter"
          className="mb-1 block text-sm font-medium text-muted-foreground"
        >
          Jobbnamn
        </label>
        <Select
          value={currentJobName ?? '__all'}
          onValueChange={(v) =>
            updateParam('jobName', v === '__all' ? null : v)
          }
        >
          <SelectTrigger id="job-filter" className="h-9 w-[200px]">
            <SelectValue placeholder="Alla jobb" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Alla jobb</SelectItem>
            {jobNames.map((j) => (
              <SelectItem key={j.name} value={j.name}>
                {j.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label
          htmlFor="from-filter"
          className="mb-1 block text-sm font-medium text-muted-foreground"
        >
          Från
        </label>
        <DatePicker
          id="from-filter"
          value={parseISODate(currentFrom)}
          onChange={(d) => updateParam('from', d ? toISODate(d) : null)}
        />
      </div>
      <div>
        <label
          htmlFor="to-filter"
          className="mb-1 block text-sm font-medium text-muted-foreground"
        >
          Till
        </label>
        <DatePicker
          id="to-filter"
          value={parseISODate(currentTo)}
          onChange={(d) => updateParam('to', d ? toISODate(d) : null)}
        />
      </div>
      {(currentJobName || currentFrom || currentTo) && (
        <Button variant="outline" size="sm" onClick={handleClear}>
          Rensa filter
        </Button>
      )}
    </div>
  )
}
