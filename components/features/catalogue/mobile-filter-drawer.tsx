'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { CatalogueFilters } from './catalogue-filters'

interface MobileFilterDrawerProps {
  selectedTypes: string[]
  selectedStatus: string[]
  selectedBusinessType: string | undefined
  selectedCategories: string[]
  dateFrom: string | undefined
  dateTo: string | undefined
  basePath: string
  showContentTypeFilter: boolean
  contentTypeOptions?: 'all' | 'court_cases' | 'eu'
}

export function MobileFilterDrawer(props: MobileFilterDrawerProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const activeFilterCount = [
    props.selectedTypes.length > 0,
    props.selectedStatus.length > 0,
    props.selectedBusinessType !== undefined,
    props.selectedCategories.length > 0,
    props.dateFrom !== undefined,
    props.dateTo !== undefined,
  ].filter(Boolean).length

  const hasFilters = activeFilterCount > 0

  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams()
    const query = searchParams.get('q')
    if (query) params.set('q', query)
    const queryString = params.toString()
    router.push(
      queryString ? `${props.basePath}?${queryString}` : props.basePath
    )
  }, [router, searchParams, props.basePath])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full gap-2">
          <Filter className="h-4 w-4" />
          Filter
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[300px] overflow-y-auto sm:w-[340px]"
      >
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Filter</SheetTitle>
            {hasFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center text-xs text-primary hover:text-primary/80"
              >
                <X className="mr-1 h-3 w-3" />
                Rensa alla
              </button>
            )}
          </div>
        </SheetHeader>
        <div className="mt-6">
          <CatalogueFilters {...props} hideHeader />
        </div>
      </SheetContent>
    </Sheet>
  )
}
