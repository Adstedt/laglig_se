'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Landmark,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  LinkIcon,
  FilePenLine,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getDocumentTheme } from '@/lib/document-themes'
import { cn } from '@/lib/utils'
import type { ImplementedDirective } from '@/app/actions/cross-references'

export interface Amendment {
  id: string
  title: string
  slug: string | null
  effectiveDate: string | null
}

interface RelatedDocumentsSummaryProps {
  implementedDirectives: ImplementedDirective[]
  amendments?: Amendment[]
  lawTitle: string
  lawSlug?: string
  isWorkspace?: boolean
  /**
   * When true, render just the inner content (directives + amendments lists)
   * without the Card wrapper, header, or expand/collapse button. Use this
   * when the component is embedded inside an outer accordion or container
   * that already provides expansion chrome.
   */
  embedded?: boolean
}

export function RelatedDocumentsSummary({
  implementedDirectives,
  amendments = [],
  lawTitle: _lawTitle,
  lawSlug,
  isWorkspace = false,
  embedded = false,
}: RelatedDocumentsSummaryProps) {
  const browsePrefix = isWorkspace ? '/browse' : ''
  const hasDirectives = implementedDirectives.length > 0
  const hasAmendments = amendments.length > 0

  // Default to collapsed (unused when embedded)
  const [expanded, setExpanded] = useState(false)

  if (!hasDirectives && !hasAmendments) {
    return null
  }

  const euTheme = getDocumentTheme('EU_DIRECTIVE')
  const amendmentTheme = getDocumentTheme('SFS_AMENDMENT')

  const content = (
    <>
      {/* EU Directives Preview */}
      {hasDirectives && (
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Landmark className="h-4 w-4 text-purple-600" />
            Genomför EU-direktiv
          </h4>
          <div className="space-y-1">
            {implementedDirectives.slice(0, 3).map((directive) => (
              <Link
                key={directive.id}
                href={`${browsePrefix}/eu/direktiv/${directive.slug}`}
                className="group -mx-2 flex items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted/50"
              >
                <Badge className={cn('text-xs shrink-0', euTheme.badge)}>
                  EU-direktiv
                </Badge>
                <span className="truncate text-foreground group-hover:text-primary">
                  {directive.title}
                </span>
                <ArrowUpRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
              </Link>
            ))}
          </div>
          {implementedDirectives.length > 3 && (
            <Button variant="link" className="mt-2 h-auto p-0 text-sm">
              Visa alla {implementedDirectives.length} EU-direktiv
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Amendments Preview */}
      {hasAmendments && (
        <div className={cn(hasDirectives && 'mt-4 border-t pt-4')}>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FilePenLine className="h-4 w-4 text-orange-600" />
            Ändringsförfattningar
          </h4>
          <div className="space-y-1">
            {amendments.slice(0, 5).map((amendment) => {
              const amendmentUrl = amendment.slug
                ? `${browsePrefix}/lagar/andringar/${amendment.slug}`
                : null

              return (
                <div
                  key={amendment.id}
                  className="group -mx-2 flex items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <Badge
                    className={cn('text-xs shrink-0', amendmentTheme.badge)}
                  >
                    Ändring
                  </Badge>
                  {amendmentUrl ? (
                    <Link
                      href={amendmentUrl}
                      className="flex-1 truncate text-foreground group-hover:text-primary"
                    >
                      {amendment.title}
                    </Link>
                  ) : (
                    <span className="flex-1 truncate text-foreground">
                      {amendment.title}
                    </span>
                  )}
                  {amendment.effectiveDate && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(amendment.effectiveDate).toLocaleDateString(
                        'sv-SE'
                      )}
                    </span>
                  )}
                  {amendmentUrl && (
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                  )}
                </div>
              )
            })}
          </div>
          {amendments.length > 5 && lawSlug && (
            <Link
              href={`${browsePrefix}/lagar/${lawSlug}/historik`}
              className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Visa alla {amendments.length} ändringar
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}
    </>
  )

  // Embedded mode — skip the Card/expand chrome (outer accordion provides it)
  if (embedded) {
    return <div data-references-section>{content}</div>
  }

  return (
    <Card
      className="mb-6 border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/20"
      data-references-section
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <LinkIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span className="font-semibold text-foreground">
              Relaterade dokument
            </span>
            <div className="flex items-center gap-2">
              {hasDirectives && (
                <Badge className="gap-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-300">
                  <Landmark className="h-3.5 w-3.5" />
                  {implementedDirectives.length} EU-direktiv
                </Badge>
              )}
              {hasAmendments && (
                <Badge className="gap-1.5 bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/50 dark:text-orange-300">
                  <FilePenLine className="h-3.5 w-3.5" />
                  {amendments.length} ändringar
                </Badge>
              )}
            </div>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-muted-foreground transition-transform duration-200',
            !expanded && '-rotate-90'
          )}
        />
      </button>

      {expanded && (
        <CardContent className="border-t px-4 pt-4 pb-4">{content}</CardContent>
      )}
    </Card>
  )
}
