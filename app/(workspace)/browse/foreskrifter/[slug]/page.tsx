import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ExternalLink } from 'lucide-react'
import { getDocumentTheme } from '@/lib/document-themes'
import { cn } from '@/lib/utils'
import { BackToTopButton } from '@/app/(public)/lagar/[id]/toc-client'
import { LegalDocumentCard } from '@/components/features/legal-document-card'
import { rewriteLinksForWorkspace } from '@/lib/linkify/rewrite-links'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

async function getDocument(slug: string) {
  return prisma.legalDocument.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      document_number: true,
      slug: true,
      content_type: true,
      full_text: true,
      html_content: true,
      source_url: true,
      status: true,
      metadata: true,
    },
  })
}

export default async function WorkspaceForeskriftPage({ params }: PageProps) {
  const { slug } = await params
  const doc = await getDocument(slug)

  if (!doc || doc.content_type !== 'AGENCY_REGULATION') {
    notFound()
  }

  const isStub = doc.full_text === null
  const metadata = doc.metadata as Record<string, unknown> | null
  const theme = getDocumentTheme('AGENCY_REGULATION')
  const ThemeIcon = theme.icon

  return (
    <div className="has-hero-header mx-auto max-w-4xl space-y-6">
      {/* Hero Header */}
      <header className="rounded-xl bg-card p-6 shadow-sm border">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
              theme.accentLight
            )}
          >
            <ThemeIcon className={cn('h-6 w-6', theme.accent)} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl leading-tight">
              {doc.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge className={cn('gap-1', theme.badge)}>
                <ThemeIcon className="h-3.5 w-3.5" />
                {theme.label}
              </Badge>
              <Badge variant="secondary" className="font-mono text-sm">
                {doc.document_number}
              </Badge>
              {metadata?.regulatoryBody ? (
                <Badge variant="outline">
                  {String(metadata.regulatoryBody)}
                </Badge>
              ) : null}
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  doc.status === 'ACTIVE' &&
                    'border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400',
                  doc.status === 'REPEALED' &&
                    'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400'
                )}
              >
                {doc.status === 'ACTIVE'
                  ? 'Gällande'
                  : doc.status === 'REPEALED'
                    ? 'Upphävd'
                    : doc.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Source link */}
        {doc.source_url && (
          <div className="mt-6 flex items-center gap-4 text-sm text-muted-foreground border-t pt-4">
            <div className="ml-auto">
              <a
                href={doc.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-1.5 hover:underline',
                  theme.accent
                )}
              >
                <span>Källa</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </header>

      {/* External PDF stub — link directly to the source PDF */}
      {isStub &&
        metadata?.method === 'stub-external-pdf' &&
        !!metadata?.pdfUrl && (
          <Card>
            <CardContent className="p-6 text-center">
              <a
                href={String(metadata.pdfUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium transition-colors hover:bg-accent',
                  theme.accent
                )}
              >
                <ExternalLink className="h-4 w-4" />
                Öppna originaldokument (PDF)
              </a>
            </CardContent>
          </Card>
        )}

      {/* Generic stub notice */}
      {isStub &&
        !(metadata?.method === 'stub-external-pdf' && metadata?.pdfUrl) && (
          <Card>
            <CardContent className="p-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Dokumentet är registrerat men fullständigt innehåll läggs till
                  inom kort.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Full content */}
      {!isStub && doc.html_content && (
        <LegalDocumentCard
          htmlContent={rewriteLinksForWorkspace(doc.html_content)}
        />
      )}

      <BackToTopButton />
    </div>
  )
}
