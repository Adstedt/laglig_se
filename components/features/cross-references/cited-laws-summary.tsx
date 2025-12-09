'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  FileText,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  LinkIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getDocumentTheme } from '@/lib/document-themes'
import { cn } from '@/lib/utils'

interface CitedLaw {
  id: string
  title: string
  slug: string
  document_number: string
  context?: string | null
}

interface CitedLawsSummaryProps {
  citedLaws: CitedLaw[]
}

export function CitedLawsSummary({ citedLaws }: CitedLawsSummaryProps) {
  // Default to collapsed
  const [expanded, setExpanded] = useState(false)

  // Don't render if no cited laws
  if (citedLaws.length === 0) {
    return null
  }

  const lawTheme = getDocumentTheme('SFS_LAW')

  return (
    <Card
      className="mb-6 border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50/50 to-transparent dark:from-amber-950/20"
      data-cited-laws-section
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <LinkIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="font-semibold text-foreground">
              Citerade lagar
            </span>
            <Badge className="gap-1.5 bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300">
              <FileText className="h-3.5 w-3.5" />
              {citedLaws.length} lagar
            </Badge>
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
          <div className="mt-4 space-y-1">
            {citedLaws.slice(0, 5).map((law) => (
              <Link
                key={law.id}
                href={`/lagar/${law.slug}`}
                className="flex items-center gap-2 p-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors group text-sm"
              >
                <Badge className={cn('text-xs shrink-0', lawTheme.badge)}>
                  Lag
                </Badge>
                <div className="flex-1 min-w-0">
                  <span className="truncate text-foreground group-hover:text-primary block">
                    {law.title}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {law.document_number}
                  </span>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
              </Link>
            ))}
          </div>
          {citedLaws.length > 5 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                // Scroll to full list at bottom
                const fullList = document.querySelector(
                  '[data-full-cited-laws]'
                )
                if (fullList) {
                  fullList.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  })
                }
              }}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-3"
            >
              Visa alla {citedLaws.length} lagar
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </CardContent>
      )}
    </Card>
  )
}
