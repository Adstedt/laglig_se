import { notFound } from 'next/navigation'
import { ContentType } from '@prisma/client'
import type { Metadata } from 'next'
import sanitizeHtml from 'sanitize-html'
import {
  getCachedCourtCase,
  getCachedCourtCaseMetadata,
} from '@/lib/cache/cached-queries'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays, Building2, ExternalLink, Users } from 'lucide-react'
import { getDocumentTheme } from '@/lib/document-themes'
import { cn } from '@/lib/utils'
import { ContentWithStyledHeadings } from '@/components/features/content'
import { BackToTopButton } from '@/app/(public)/lagar/[id]/toc-client'
import { CitedLawsSummary } from '@/components/features/cross-references'
import { FloatingCitedLawsWrapper } from '@/app/(public)/rattsfall/[court]/[id]/floating-cited-laws-wrapper'
import { RelatedDocsPrefetcher } from '@/components/features/court-case'
import { rewriteLinksForWorkspace } from '@/lib/linkify/rewrite-links'

// Court URL mapping
const COURT_URL_MAP: Record<
  string,
  { contentType: ContentType; name: string }
> = {
  hd: { contentType: ContentType.COURT_CASE_HD, name: 'Högsta domstolen' },
  hovr: { contentType: ContentType.COURT_CASE_HOVR, name: 'Hovrätten' },
  hfd: {
    contentType: ContentType.COURT_CASE_HFD,
    name: 'Högsta förvaltningsdomstolen',
  },
  ad: { contentType: ContentType.COURT_CASE_AD, name: 'Arbetsdomstolen' },
  mod: {
    contentType: ContentType.COURT_CASE_MOD,
    name: 'Mark- och miljööverdomstolen',
  },
  mig: {
    contentType: ContentType.COURT_CASE_MIG,
    name: 'Migrationsöverdomstolen',
  },
}

interface PageProps {
  params: Promise<{ court: string; id: string }>
}

function formatDateOrNull(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions
): string | null {
  if (!date) return null
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString('sv-SE', options)
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { court, id } = await params

  const courtInfo = COURT_URL_MAP[court]
  if (!courtInfo) {
    return { title: 'Rättsfall hittades inte | Laglig.se' }
  }

  const document = await getCachedCourtCaseMetadata(id, courtInfo.contentType)

  if (!document) {
    return { title: 'Rättsfall hittades inte | Laglig.se' }
  }

  const courtCase = document.court_case
  const title = courtCase
    ? `${courtCase.court_name} ${courtCase.case_number}`
    : document.title

  return {
    title: `${title} | Laglig.se`,
    description:
      document.summary?.substring(0, 155) ||
      `Läs rättsfallet ${title} i sin helhet`,
  }
}

export default async function WorkspaceCourtCasePage({ params }: PageProps) {
  const { court, id } = await params

  const courtInfo = COURT_URL_MAP[court]
  if (!courtInfo) {
    notFound()
  }

  const document = await getCachedCourtCase(id, courtInfo.contentType)

  if (!document) {
    notFound()
  }

  const courtCase = document.court_case

  // Sanitize HTML content
  const sanitizedHtml = document.html_content
    ? sanitizeHtml(document.html_content, {
        allowedTags: [
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'p',
          'br',
          'hr',
          'ul',
          'ol',
          'li',
          'table',
          'thead',
          'tbody',
          'tr',
          'th',
          'td',
          'a',
          'strong',
          'em',
          'span',
          'div',
          'blockquote',
          'pre',
          'code',
          'b',
          'i',
          'u',
          'sub',
          'sup',
        ],
        allowedAttributes: {
          a: ['href', 'name', 'class', 'title', 'target', 'rel'],
          '*': ['class', 'id', 'name'],
        },
      })
    : null

  const formattedDecisionDate = formatDateOrNull(courtCase?.decision_date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Parse parties from JSON
  const parties = courtCase?.parties as {
    plaintiff?: string
    defendant?: string
    plaintiff_counsel?: string
    defendant_counsel?: string
  } | null

  // Get theme based on court content type
  const theme = getDocumentTheme(courtInfo.contentType)
  const ThemeIcon = theme.icon

  return (
    <div className="mx-auto max-w-4xl space-y-6">
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
              {document.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge className={cn('gap-1', theme.badge)}>
                <ThemeIcon className="h-3.5 w-3.5" />
                {theme.label}
              </Badge>
              {courtCase?.case_number && (
                <Badge variant="secondary" className="font-mono text-sm">
                  {courtCase.case_number}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Quick Info Bar */}
        <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground border-t pt-4">
          {formattedDecisionDate && (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              <span>Avgörandedatum {formattedDecisionDate}</span>
            </div>
          )}
          {courtCase?.lower_court && (
            <div className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              <span>Underinstans: {courtCase.lower_court}</span>
            </div>
          )}
          {document.source_url && (
            <a
              href={document.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-1.5 hover:underline ml-auto',
                theme.accent
              )}
            >
              <span>Källa</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </header>

      {/* Cited Laws Summary */}
      <CitedLawsSummary
        citedLaws={document.source_references.map((ref) => ({
          id: ref.id,
          title: ref.target_document.title,
          slug: ref.target_document.slug,
          document_number: ref.target_document.document_number,
          context: ref.context,
        }))}
      />

      {/* Case Details - Parties */}
      {(parties?.plaintiff || parties?.defendant) && (
        <Card className="border-l-4 border-l-primary/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Parter
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {parties?.plaintiff && (
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">
                  Kärande
                </p>
                <p className="text-sm font-medium">{parties.plaintiff}</p>
                {parties?.plaintiff_counsel && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ombud: {parties.plaintiff_counsel}
                  </p>
                )}
              </div>
            )}
            {parties?.defendant && (
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">
                  Svarande
                </p>
                <p className="text-sm font-medium">{parties.defendant}</p>
                {parties?.defendant_counsel && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ombud: {parties.defendant_counsel}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      {document.summary && (
        <Card className="border-l-4 border-l-primary/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-muted-foreground">
              Sammanfattning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground leading-relaxed">
              {document.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Judgment content */}
      <Card>
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-lg">Domslut</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <article className="legal-document p-6 md:p-8">
            {sanitizedHtml ? (
              <ContentWithStyledHeadings
                htmlContent={rewriteLinksForWorkspace(sanitizedHtml)}
              />
            ) : document.full_text ? (
              <div className="whitespace-pre-wrap font-serif">
                {document.full_text}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="italic text-muted-foreground mb-4">
                  Domtexten är inte tillgänglig i digital form.
                </p>
                {(document.metadata as Record<string, unknown>)?.attachments &&
                Array.isArray(
                  (document.metadata as Record<string, unknown>).attachments
                ) &&
                (
                  (document.metadata as Record<string, unknown>)
                    .attachments as Array<{ filename: string }>
                ).length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Detta avgörande finns endast som PDF-bilaga hos
                    Domstolsverket.
                  </p>
                ) : null}
              </div>
            )}
          </article>
        </CardContent>
      </Card>

      {/* Footer */}
      <footer className="text-center text-sm text-muted-foreground py-4 border-t">
        <p>
          Källa: {courtInfo.name}
          {document.source_url &&
            (document.html_content || document.full_text) && (
              <>
                {' '}
                <a
                  href={document.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  (visa original)
                </a>
              </>
            )}
        </p>
      </footer>

      {/* Back to top button */}
      <BackToTopButton />

      {/* Floating button for cited laws */}
      <FloatingCitedLawsWrapper lawCount={document.source_references.length} />

      {/* Prefetch related documents */}
      <RelatedDocsPrefetcher
        citedLaws={document.source_references.map((ref) => ({
          slug: ref.target_document.slug,
        }))}
      />
    </div>
  )
}
