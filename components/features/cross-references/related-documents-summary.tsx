'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Scale,
  Landmark,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  LinkIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getDocumentTheme } from '@/lib/document-themes'
import { cn } from '@/lib/utils'
import type {
  CitingCourtCase,
  ImplementedDirective,
} from '@/app/actions/cross-references'

// Map content type to court URL segment
const COURT_URL_MAP: Record<string, string> = {
  COURT_CASE_AD: 'ad',
  COURT_CASE_HD: 'hd',
  COURT_CASE_HFD: 'hfd',
  COURT_CASE_HOVR: 'hovr',
  COURT_CASE_MOD: 'mod',
  COURT_CASE_MIG: 'mig',
}

interface RelatedDocumentsSummaryProps {
  citingCases: {
    cases: CitingCourtCase[]
    totalCount: number
  }
  implementedDirectives: ImplementedDirective[]
  lawTitle: string
  isWorkspace?: boolean
}

export function RelatedDocumentsSummary({
  citingCases,
  implementedDirectives,
  lawTitle,
  isWorkspace = false,
}: RelatedDocumentsSummaryProps) {
  // Prefix for internal links - workspace or public
  const browsePrefix = isWorkspace ? '/browse' : ''
  const hasCourtCases = citingCases.totalCount > 0
  const hasDirectives = implementedDirectives.length > 0

  // Default to collapsed
  const [expanded, setExpanded] = useState(false)

  // Don't render if no related documents
  if (!hasCourtCases && !hasDirectives) {
    return null
  }

  const euTheme = getDocumentTheme('EU_DIRECTIVE')

  return (
    <Card
      className="mb-6 border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/20"
      data-references-section
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <LinkIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="font-semibold text-foreground">
              Relaterade dokument
            </span>
            <div className="flex items-center gap-2">
              {hasCourtCases && (
                <Badge className="gap-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300">
                  <Scale className="h-3.5 w-3.5" />
                  {citingCases.totalCount} rättsfall
                </Badge>
              )}
              {hasDirectives && (
                <Badge className="gap-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-300">
                  <Landmark className="h-3.5 w-3.5" />
                  {implementedDirectives.length} EU-direktiv
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
        <CardContent className="pt-0 pb-4 px-4 border-t">
          {/* Court Cases Preview */}
          {hasCourtCases && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <Scale className="h-4 w-4 text-blue-600" />
                Citeras i rättsfall
              </h4>
              <div className="space-y-1">
                {citingCases.cases.slice(0, 3).map((courtCase) => {
                  const theme = getDocumentTheme(courtCase.contentType)
                  const courtSegment =
                    COURT_URL_MAP[courtCase.contentType] || 'hd'
                  const caseUrl = `${browsePrefix}/rattsfall/${courtSegment}/${courtCase.slug}`

                  return (
                    <Link
                      key={courtCase.id}
                      href={caseUrl}
                      className="flex items-center gap-2 p-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors group text-sm"
                    >
                      <Badge className={cn('text-xs shrink-0', theme.badge)}>
                        {theme.label}
                      </Badge>
                      <span className="truncate text-foreground group-hover:text-primary">
                        {courtCase.title}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 ml-auto" />
                    </Link>
                  )
                })}
              </div>
              {citingCases.totalCount > 3 && (
                <Link
                  href={`${browsePrefix}/sok?q=${encodeURIComponent(lawTitle)}&types=COURT_CASE_AD,COURT_CASE_HD,COURT_CASE_HFD,COURT_CASE_HOVR`}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                >
                  Visa alla {citingCases.totalCount} rättsfall
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          )}

          {/* EU Directives Preview */}
          {hasDirectives && (
            <div className={cn('mt-4', hasCourtCases && 'pt-4 border-t')}>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <Landmark className="h-4 w-4 text-purple-600" />
                Genomför EU-direktiv
              </h4>
              <div className="space-y-1">
                {implementedDirectives.slice(0, 3).map((directive) => (
                  <Link
                    key={directive.id}
                    href={`${browsePrefix}/eu/direktiv/${directive.slug}`}
                    className="flex items-center gap-2 p-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors group text-sm"
                  >
                    <Badge className={cn('text-xs shrink-0', euTheme.badge)}>
                      EU-direktiv
                    </Badge>
                    <span className="truncate text-foreground group-hover:text-primary">
                      {directive.title}
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 ml-auto" />
                  </Link>
                ))}
              </div>
              {implementedDirectives.length > 3 && (
                <Button variant="link" className="h-auto p-0 text-sm mt-2">
                  Visa alla {implementedDirectives.length} EU-direktiv
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
