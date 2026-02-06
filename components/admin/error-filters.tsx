'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

import { Button } from '@/components/ui/button'

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
        <select
          id="job-filter"
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={currentJobName ?? ''}
          onChange={(e) => updateParam('jobName', e.target.value || null)}
        >
          <option value="">Alla jobb</option>
          {jobNames.map((j) => (
            <option key={j.name} value={j.name}>
              {j.displayName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="from-filter"
          className="mb-1 block text-sm font-medium text-muted-foreground"
        >
          Från
        </label>
        <input
          id="from-filter"
          type="date"
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={currentFrom ?? ''}
          onChange={(e) => updateParam('from', e.target.value || null)}
        />
      </div>
      <div>
        <label
          htmlFor="to-filter"
          className="mb-1 block text-sm font-medium text-muted-foreground"
        >
          Till
        </label>
        <input
          id="to-filter"
          type="date"
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={currentTo ?? ''}
          onChange={(e) => updateParam('to', e.target.value || null)}
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
