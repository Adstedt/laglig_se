'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Plus,
  Minus,
  Edit,
} from 'lucide-react'

interface Amendment {
  sfsNumber: string
  effectiveDate: string // YYYY-MM-DD
  title?: string
  sectionsChanged: number
  sectionsAdded?: number
  sectionsRepealed?: number
}

interface VersionTimelineProps {
  lawSlug: string
  amendments: Amendment[]
  currentVersionDate?: string // If viewing a historical version, highlight it
  showCompact?: boolean // For inline use in law page
  maxVisible?: number // Maximum amendments to show before "show more"
}

export function VersionTimeline({
  lawSlug,
  amendments,
  currentVersionDate,
  showCompact = false,
  maxVisible = 10,
}: VersionTimelineProps) {
  const [expanded, setExpanded] = useState(false)

  const visibleAmendments = expanded
    ? amendments
    : amendments.slice(0, maxVisible)
  const hasMore = amendments.length > maxVisible

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
    })
  }

  // Format SFS number (remove "SFS " prefix if present to avoid double prefix)
  const formatSfs = (sfs: string) => {
    return sfs.replace(/^SFS\s*/i, '')
  }

  if (amendments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Ingen ändringshistorik tillgänglig
      </div>
    )
  }

  if (showCompact) {
    return (
      <div className="space-y-1">
        {visibleAmendments.map((amendment) => (
          <Link
            key={amendment.sfsNumber}
            href={`/lagar/${lawSlug}/version/${amendment.effectiveDate}`}
            className={cn(
              'flex items-center justify-between p-2 rounded-md text-sm hover:bg-muted/50 transition-colors',
              currentVersionDate === amendment.effectiveDate &&
                'bg-primary/10 border border-primary/20'
            )}
          >
            <span className="font-medium">
              {formatShortDate(amendment.effectiveDate)}
            </span>
            <Badge variant="outline" className="text-xs">
              SFS {formatSfs(amendment.sfsNumber)}
            </Badge>
          </Link>
        ))}
        {hasMore && !expanded && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => setExpanded(true)}
          >
            Visa {amendments.length - maxVisible} fler
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>
    )
  }

  // Full timeline view
  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-0">
        {/* Current version node */}
        <div className="relative flex items-start gap-4 pb-6">
          <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex-1 pt-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Gällande version</span>
              <Badge>Nuvarande</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Senast ändrad: SFS {formatSfs(amendments[0]?.sfsNumber || '')}
            </p>
          </div>
        </div>

        {/* Amendment nodes */}
        {visibleAmendments.map((amendment) => {
          const isActive = currentVersionDate === amendment.effectiveDate

          return (
            <Link
              key={amendment.sfsNumber}
              href={`/lagar/${lawSlug}/version/${amendment.effectiveDate}`}
              className="block group"
            >
              <div
                className={cn(
                  'relative flex items-start gap-4 pb-6 transition-colors',
                  isActive && 'bg-primary/5 -mx-4 px-4 rounded-lg'
                )}
              >
                {/* Timeline node */}
                <div
                  className={cn(
                    'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                    isActive
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-background border-muted-foreground/30 group-hover:border-primary/50'
                  )}
                >
                  <Edit className="h-3.5 w-3.5" />
                </div>

                {/* Content */}
                <div className="flex-1 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {formatDate(amendment.effectiveDate)}
                    </span>
                    <Badge variant="outline" className="font-mono text-xs">
                      SFS {formatSfs(amendment.sfsNumber)}
                    </Badge>
                    {isActive && (
                      <Badge variant="secondary" className="text-xs">
                        Visar nu
                      </Badge>
                    )}
                  </div>

                  {amendment.title && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {amendment.title}
                    </p>
                  )}

                  {/* Change summary */}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    {amendment.sectionsChanged > 0 && (
                      <span className="flex items-center gap-1">
                        <Edit className="h-3 w-3" />
                        {amendment.sectionsChanged} ändrade
                      </span>
                    )}
                    {amendment.sectionsAdded && amendment.sectionsAdded > 0 && (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <Plus className="h-3 w-3" />
                        {amendment.sectionsAdded} nya
                      </span>
                    )}
                    {amendment.sectionsRepealed &&
                      amendment.sectionsRepealed > 0 && (
                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                          <Minus className="h-3 w-3" />
                          {amendment.sectionsRepealed} upphävda
                        </span>
                      )}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}

        {/* Show more/less button */}
        {hasMore && (
          <div className="relative flex items-start gap-4">
            <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-0.5"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded
                ? 'Visa färre'
                : `Visa ${amendments.length - maxVisible} fler ändringar`}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
