import Link from 'next/link'
import { Landmark, ArrowUpRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getDocumentTheme } from '@/lib/document-themes'
import { cn } from '@/lib/utils'
import type { ImplementedDirective } from '@/app/actions/cross-references'

interface ImplementedDirectivesProps {
  directives: ImplementedDirective[]
}

export function ImplementedDirectives({
  directives,
}: ImplementedDirectivesProps) {
  if (directives.length === 0) {
    return null
  }

  const theme = getDocumentTheme('EU_DIRECTIVE')

  return (
    <Card className="mb-8">
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="text-lg flex items-center gap-2">
          <Landmark className="h-5 w-5 text-purple-600" />
          Genomför EU-direktiv ({directives.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {directives.map((directive) => (
            <Link
              key={directive.id}
              href={`/eu/direktiv/${directive.slug}`}
              className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors group"
            >
              <div
                className={cn(
                  'hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  theme.accentLight
                )}
              >
                <Landmark className={cn('h-5 w-5', theme.accent)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={cn('text-xs', theme.badge)}>
                    EU-direktiv
                  </Badge>
                  {directive.celexNumber && (
                    <span className="text-sm font-mono text-muted-foreground">
                      {directive.celexNumber}
                    </span>
                  )}
                </div>
                <p className="font-medium text-foreground group-hover:text-primary line-clamp-2">
                  {directive.title}
                </p>
                {directive.context && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {directive.context}
                  </p>
                )}
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
