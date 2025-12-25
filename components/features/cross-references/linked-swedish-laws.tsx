import Link from 'next/link'
import { FileText, ArrowUpRight, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getDocumentTheme } from '@/lib/document-themes'
import { cn } from '@/lib/utils'

export interface SwedishMeasure {
  sfs_number: string
  title?: string | undefined
  slug?: string | null | undefined // null if law not in database
}

interface LinkedSwedishLawsProps {
  measures: SwedishMeasure[]
  isWorkspace?: boolean
}

export function LinkedSwedishLaws({
  measures,
  isWorkspace = false,
}: LinkedSwedishLawsProps) {
  // Prefix for internal links - workspace or public
  const basePath = isWorkspace ? '/browse/lagar' : '/lagar'
  if (measures.length === 0) {
    return null
  }

  const theme = getDocumentTheme('SFS_LAW')

  return (
    <Card className="mb-8" data-implementations-section>
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="text-lg flex items-center gap-2">
          <span className="text-lg">🇸🇪</span>
          Svenska genomförandeåtgärder ({measures.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {measures.map((measure, index) => {
            const hasLink = !!measure.slug

            const content = (
              <div className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors group">
                <div
                  className={cn(
                    'hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    theme.accentLight
                  )}
                >
                  <FileText className={cn('h-5 w-5', theme.accent)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={cn('text-xs', theme.badge)}>Lag</Badge>
                    <span className="text-sm font-mono text-muted-foreground">
                      SFS {measure.sfs_number}
                    </span>
                  </div>
                  {measure.title && (
                    <p
                      className={cn(
                        'font-medium line-clamp-2',
                        hasLink
                          ? 'text-foreground group-hover:text-primary'
                          : 'text-muted-foreground'
                      )}
                    >
                      {measure.title}
                    </p>
                  )}
                </div>
                {hasLink ? (
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                ) : (
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </div>
            )

            if (hasLink) {
              return (
                <Link key={index} href={`${basePath}/${measure.slug}`}>
                  {content}
                </Link>
              )
            }

            return (
              <div key={index} className="opacity-75">
                {content}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
