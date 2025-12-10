'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PER_PAGE_OPTIONS = [
  { value: '25', label: '25 per sida' },
  { value: '50', label: '50 per sida' },
  { value: '100', label: '100 per sida' },
]

interface CataloguePaginationProps {
  currentPage: number
  totalPages: number
  perPage: number
  total: number
  basePath: string
}

export function CataloguePagination({
  currentPage,
  totalPages,
  perPage,
  total,
  basePath,
}: CataloguePaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPrefetching, setIsPrefetching] = useState(false)

  const buildPageUrl = useCallback(
    (page: number, newPerPage?: number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (page === 1) {
        params.delete('page')
      } else {
        params.set('page', page.toString())
      }
      if (newPerPage && newPerPage !== 25) {
        params.set('per_page', newPerPage.toString())
      } else if (newPerPage === 25) {
        params.delete('per_page')
      }
      const queryString = params.toString()
      return queryString ? `${basePath}?${queryString}` : basePath
    },
    [searchParams, basePath]
  )

  // Pre-fetch page 2 after initial render
  useEffect(() => {
    if (currentPage === 1 && totalPages > 1 && !isPrefetching) {
      setIsPrefetching(true)
      router.prefetch(buildPageUrl(2))
    }
  }, [currentPage, totalPages, isPrefetching, router, buildPageUrl])

  // Pre-fetch on hover
  const handlePageHover = useCallback(
    (targetPage: number) => {
      if (targetPage >= 1 && targetPage <= totalPages) {
        router.prefetch(buildPageUrl(targetPage))
      }
    },
    [router, buildPageUrl, totalPages]
  )

  const handlePerPageChange = useCallback(
    (value: string) => {
      const newPerPage = parseInt(value, 10)
      const params = new URLSearchParams(searchParams.toString())
      // Reset to page 1 when changing per_page
      params.delete('page')
      if (newPerPage !== 25) {
        params.set('per_page', value)
      } else {
        params.delete('per_page')
      }
      const queryString = params.toString()
      router.push(queryString ? `${basePath}?${queryString}` : basePath)
    },
    [router, searchParams, basePath]
  )

  // Generate page numbers to show
  const getPageNumbers = useCallback(() => {
    const pages: (number | 'ellipsis')[] = []
    const showPages = 5

    if (totalPages <= showPages + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)

      if (currentPage > 3) {
        pages.push('ellipsis')
      }

      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis')
      }

      pages.push(totalPages)
    }

    return pages
  }, [currentPage, totalPages])

  const pages = getPageNumbers()

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
      {/* Page info and per-page selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          Sida {currentPage} av {totalPages} ({total.toLocaleString('sv-SE')}{' '}
          totalt)
        </span>
        <Select value={perPage.toString()} onValueChange={handlePerPageChange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PER_PAGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pagination controls */}
      <nav className="flex items-center gap-1" aria-label="Sidnavigering">
        {/* Previous Button */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          disabled={currentPage <= 1}
          asChild={currentPage > 1}
          onMouseEnter={() => handlePageHover(currentPage - 1)}
        >
          {currentPage > 1 ? (
            <Link href={buildPageUrl(currentPage - 1)} prefetch={false}>
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Föregående</span>
            </Link>
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Föregående</span>
            </>
          )}
        </Button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1">
          {pages.map((page, index) => {
            if (page === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-muted-foreground"
                >
                  ...
                </span>
              )
            }

            const isActive = page === currentPage

            return (
              <Button
                key={page}
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                className={cn('h-9 w-9 p-0', isActive && 'pointer-events-none')}
                asChild={!isActive}
                onMouseEnter={() => !isActive && handlePageHover(page)}
              >
                {isActive ? (
                  <span>{page}</span>
                ) : (
                  <Link href={buildPageUrl(page)} prefetch={false}>
                    {page}
                  </Link>
                )}
              </Button>
            )
          })}
        </div>

        {/* Next Button */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          disabled={currentPage >= totalPages}
          asChild={currentPage < totalPages}
          onMouseEnter={() => handlePageHover(currentPage + 1)}
        >
          {currentPage < totalPages ? (
            <Link href={buildPageUrl(currentPage + 1)} prefetch={false}>
              <span className="hidden sm:inline">Nästa</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <span className="hidden sm:inline">Nästa</span>
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </nav>
    </div>
  )
}
