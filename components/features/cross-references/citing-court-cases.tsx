import Link from 'next/link'
import { Scale, ArrowUpRight, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getDocumentTheme } from '@/lib/document-themes'
import { cn } from '@/lib/utils'
import type { CitingCourtCase } from '@/app/actions/cross-references'

// Map content type to court URL segment
const COURT_URL_MAP: Record<string, string> = {
  COURT_CASE_AD: 'ad',
  COURT_CASE_HD: 'hd',
  COURT_CASE_HFD: 'hfd',
  COURT_CASE_HOVR: 'hovr',
  COURT_CASE_MOD: 'mod',
  COURT_CASE_MIG: 'mig',
}

interface CitingCourtCasesProps {
  cases: CitingCourtCase[]
  totalCount: number
  lawTitle: string
}

export function CitingCourtCases({
  cases,
  totalCount,
  lawTitle,
}: CitingCourtCasesProps) {
  if (cases.length === 0) {
    return null
  }

  return (
    <Card className="mb-8">
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="text-lg flex items-center gap-2">
          <Scale className="h-5 w-5 text-blue-600" />
          Citeras i rättsfall ({totalCount})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {cases.map((courtCase) => {
            const theme = getDocumentTheme(courtCase.contentType)
            const courtSegment = COURT_URL_MAP[courtCase.contentType] || 'hd'
            const caseUrl = `/rattsfall/${courtSegment}/${courtCase.slug}`

            return (
              <Link
                key={courtCase.id}
                href={caseUrl}
                className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors group"
              >
                <div
                  className={cn(
                    'hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    theme.accentLight
                  )}
                >
                  <Scale className={cn('h-5 w-5', theme.accent)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={cn('text-xs', theme.badge)}>
                      {theme.label}
                    </Badge>
                    {courtCase.caseNumber && (
                      <span className="text-sm font-mono text-muted-foreground">
                        {courtCase.caseNumber}
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-foreground group-hover:text-primary line-clamp-2">
                    {courtCase.title}
                  </p>
                  {courtCase.context && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {courtCase.context.length > 150
                        ? `${courtCase.context.slice(0, 150)}...`
                        : courtCase.context}
                    </p>
                  )}
                  {courtCase.decisionDate && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Avgörandedatum:{' '}
                      {new Date(courtCase.decisionDate).toLocaleDateString(
                        'sv-SE'
                      )}
                    </p>
                  )}
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
              </Link>
            )
          })}
        </div>

        {/* Show all link if there are more cases */}
        {totalCount > cases.length && (
          <div className="p-4 border-t">
            <Link
              href={`/sok?q=${encodeURIComponent(lawTitle)}&types=COURT_CASE_AD,COURT_CASE_HD,COURT_CASE_HFD,COURT_CASE_HOVR`}
              className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
            >
              Visa alla {totalCount} rättsfall
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
