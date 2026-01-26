'use client'

/**
 * Story 6.7b: Folder Breadcrumb Navigation
 * AC: 5, 34 - Clickable breadcrumb with truncation and Alt+Up shortcut
 */

import React, { useEffect, useCallback } from 'react'
import { ChevronRight, Home, MoreHorizontal, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { BreadcrumbSegment } from '@/app/actions/files'

// ============================================================================
// Types
// ============================================================================

interface FolderBreadcrumbProps {
  segments: BreadcrumbSegment[]
  onNavigate: (_folderId: string | null) => void
  className?: string
}

// ============================================================================
// Component
// ============================================================================

export function FolderBreadcrumb({
  segments,
  onNavigate,
  className,
}: FolderBreadcrumbProps) {
  // Alt+Up shortcut to navigate to parent folder
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault()
        // Navigate to parent folder (second to last segment)
        if (segments.length > 1) {
          const parentSegment = segments[segments.length - 2]
          onNavigate(parentSegment?.id ?? null)
        }
      }
    },
    [segments, onNavigate]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Determine which segments to show
  // If more than 4 segments, show first, "...", and last 2
  const shouldTruncate = segments.length > 4
  const visibleSegments = shouldTruncate
    ? [
        segments[0], // Root ("Mina dokument")
        ...segments.slice(-2), // Last 2 segments
      ]
    : segments
  const hiddenSegments = shouldTruncate ? segments.slice(1, -2) : []

  const hasParent = segments.length > 1

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Parent folder button with tooltip */}
      {hasParent && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  const parentSegment = segments[segments.length - 2]
                  onNavigate(parentSegment?.id ?? null)
                }}
                aria-label="Gå till överordnad mapp (Alt+↑)"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Gå till överordnad mapp</p>
              <p className="text-xs text-muted-foreground">Alt + ↑</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <Breadcrumb>
        <BreadcrumbList>
          {visibleSegments.map((segment, index) => {
            if (!segment) return null
            const isLast = index === visibleSegments.length - 1
            const isFirst = index === 0

            // Insert "..." dropdown after first segment if truncating
            const showEllipsis =
              shouldTruncate && isFirst && hiddenSegments.length > 0

            return (
              <React.Fragment key={segment.id ?? 'root'}>
                {/* Ellipsis dropdown for hidden segments (after first item) */}
                {showEllipsis && (
                  <>
                    <BreadcrumbItem>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          className="flex items-center"
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            aria-label="Visa fler mappar"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {hiddenSegments.map((hiddenSegment) => (
                            <DropdownMenuItem
                              key={hiddenSegment?.id ?? 'root'}
                              onClick={() =>
                                onNavigate(hiddenSegment?.id ?? null)
                              }
                            >
                              {hiddenSegment?.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator>
                      <ChevronRight className="h-4 w-4" />
                    </BreadcrumbSeparator>
                  </>
                )}

                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="flex items-center gap-1.5 font-medium">
                      {isFirst && <Home className="h-4 w-4" />}
                      {segment.name}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        onNavigate(segment.id)
                      }}
                      className="flex items-center gap-1.5 hover:text-foreground"
                    >
                      {isFirst && <Home className="h-4 w-4" />}
                      {segment.name}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>

                {/* Separator after non-last items */}
                {!isLast && (
                  <BreadcrumbSeparator>
                    <ChevronRight className="h-4 w-4" />
                  </BreadcrumbSeparator>
                )}
              </React.Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}

// ============================================================================
// Simple Breadcrumb (for compact spaces)
// ============================================================================

export function FolderBreadcrumbSimple({
  segments,
  onNavigate,
  className,
}: FolderBreadcrumbProps) {
  const currentSegment = segments[segments.length - 1]
  const parentSegment =
    segments.length > 1 ? segments[segments.length - 2] : null

  return (
    <div className={cn('flex items-center gap-1 text-sm', className)}>
      {parentSegment && (
        <>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-muted-foreground hover:text-foreground"
            onClick={() => onNavigate(parentSegment.id)}
          >
            {parentSegment.name}
          </Button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </>
      )}
      <span className="font-medium">{currentSegment?.name}</span>
    </div>
  )
}
