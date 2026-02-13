import { notFound } from 'next/navigation'
import { DocumentStatus } from '@prisma/client'
import type { Metadata } from 'next'
import sanitizeHtml from 'sanitize-html'
import { getCachedLaw, getCachedLawMetadata } from '@/lib/cache/cached-queries'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays, Building2, ExternalLink } from 'lucide-react'
import { BackToTopButton } from '@/app/(public)/lagar/[id]/toc-client'
import { FloatingReferencesWrapper } from '@/app/(public)/lagar/[id]/floating-references-wrapper'
import { LawSectionWithBanner } from '@/app/(public)/lagar/[id]/law-section-with-banner'
import {
  NotYetInForceBanner,
  RelatedDocsPrefetcher,
  TimelinePrefetcher,
} from '@/components/features/law'
import { VersionSelector } from '@/components/features/law-versions'
import { getDocumentTheme } from '@/lib/document-themes'
import { cn } from '@/lib/utils'
import { RelatedDocumentsSummary } from '@/components/features/cross-references'
import {
  getCourtCasesCitingLaw,
  getImplementedEuDirectives,
} from '@/app/actions/cross-references'
import { rewriteLinksForWorkspace } from '@/lib/linkify/rewrite-links'

interface PageProps {
  params: Promise<{ id: string }>
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params
  const law = await getCachedLawMetadata(id)

  if (!law) {
    return {
      title: 'Lag hittades inte | Laglig.se',
    }
  }

  return {
    title: `${law.title} - ${law.document_number} | Laglig.se`,
    description:
      law.summary?.substring(0, 155) ||
      `Läs ${law.title} i sin helhet på Laglig.se`,
  }
}

import { cleanLawHtml } from '@/lib/sfs/clean-law-html'

// Extract metadata from Riksdagen HTML
interface LawMetadata {
  department?: string
  issuedDate?: string
  amendedThrough?: string
  repealedDate?: string
  repealedBy?: string
  sfsrUrl?: string
  fulltextUrl?: string
  effectiveDate?: string
  effectiveDateFormatted?: string
  isNotYetInForce?: boolean
}

function extractLawMetadata(html: string): LawMetadata {
  const metadata: LawMetadata = {}
  const hrIndex = html.indexOf('<hr')
  if (hrIndex === -1) return metadata

  const metaBlock = html.substring(0, hrIndex)
  const deptMatch = metaBlock.match(
    /Departement\/myndighet<\/(?:b|strong)>:\s*\n?\s*([^<\n]+)/i
  )
  if (deptMatch?.[1]) metadata.department = deptMatch[1].trim()

  const issuedMatch = metaBlock.match(
    /Utfärdad<\/(?:b|strong)>:\s*\n?\s*(\d{4}-\d{2}-\d{2})/i
  )
  if (issuedMatch?.[1]) metadata.issuedDate = issuedMatch[1]

  const amendedMatch = metaBlock.match(
    /Ändrad<\/(?:b|strong)>:\s*\n?\s*t\.o\.m\.?\s*(?:SFS\s*)?(\d{4}:\d+)/i
  )
  if (amendedMatch?.[1]) metadata.amendedThrough = amendedMatch[1]

  const repealedMatch = metaBlock.match(
    /Upphävd<\/(?:b|strong)>:\s*\n?\s*(\d{4}-\d{2}-\d{2})/i
  )
  if (repealedMatch?.[1]) metadata.repealedDate = repealedMatch[1]

  const repealedByMatch = metaBlock.match(
    /har upphävts genom<\/(?:b|strong)>:\s*\n?\s*(?:SFS\s*)?(\d{4}:\d+)/i
  )
  if (repealedByMatch?.[1]) metadata.repealedBy = repealedByMatch[1]

  const sfsrMatch = metaBlock.match(
    /href="(https?:\/\/rkrattsbaser\.gov\.se\/sfsr[^"]+)"/i
  )
  if (sfsrMatch?.[1]) metadata.sfsrUrl = sfsrMatch[1]

  const fulltextMatch = metaBlock.match(
    /href="(https?:\/\/rkrattsbaser\.gov\.se\/sfst[^"]+)"/i
  )
  if (fulltextMatch?.[1]) metadata.fulltextUrl = fulltextMatch[1]

  const afterHr = html.substring(hrIndex)
  // Look for the pattern in the first section (before any paragraph anchor)
  // Some laws have long TOC, so search up to 3000 chars or until first paragraph marker
  const firstSectionEnd = afterHr.indexOf('<a class="paragraf"')
  const altSectionEnd = afterHr.indexOf('<h3 name="K')
  const sectionEnd =
    firstSectionEnd > 0
      ? firstSectionEnd
      : altSectionEnd > 0
        ? altSectionEnd
        : 3000
  const firstSection = afterHr.substring(0, sectionEnd)

  const effectiveDateMatch = firstSection.match(
    /\/Träder i kraft I:(\d{4})-(\d{2})-(\d{2})(?:\/|<)/
  )
  if (effectiveDateMatch) {
    const year = parseInt(effectiveDateMatch[1] ?? '0')
    const month = parseInt(effectiveDateMatch[2] ?? '0')
    const day = parseInt(effectiveDateMatch[3] ?? '0')

    metadata.effectiveDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

    const effectiveDate = new Date(year, month - 1, day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    metadata.effectiveDateFormatted = effectiveDate.toLocaleDateString(
      'sv-SE',
      { year: 'numeric', month: 'long', day: 'numeric' }
    )

    metadata.isNotYetInForce = effectiveDate > today
  }

  return metadata
}

function formatDateOrNull(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions
): string | null {
  if (!date) return null
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString('sv-SE', options)
}

export default async function WorkspaceLawPage({ params }: PageProps) {
  const { id } = await params
  const law = await getCachedLaw(id)

  if (!law) {
    notFound()
  }

  const [citingCases, implementedDirectives] = await Promise.all([
    getCourtCasesCitingLaw(law.id, 10),
    getImplementedEuDirectives(law.id),
  ])

  const cleanedHtml = law.html_content ? cleanLawHtml(law.html_content) : null
  const sanitizedHtml = cleanedHtml
    ? sanitizeHtml(cleanedHtml, {
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

  const formattedPublicationDate = formatDateOrNull(law.publication_date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const theme = getDocumentTheme('SFS_LAW')
  const ThemeIcon = theme.icon
  const lawMetadata = law.html_content
    ? extractLawMetadata(law.html_content)
    : {}

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Banner for laws not yet in force */}
      {lawMetadata.isNotYetInForce && lawMetadata.effectiveDateFormatted && (
        <NotYetInForceBanner
          effectiveDate={lawMetadata.effectiveDateFormatted}
          title={law.title}
        />
      )}

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
              {law.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge className={cn('gap-1', theme.badge)}>
                <ThemeIcon className="h-3.5 w-3.5" />
                {theme.label}
              </Badge>
              <Badge variant="secondary" className="font-mono text-sm">
                {law.document_number}
              </Badge>
              <StatusBadge
                status={law.status}
                isNotYetInForce={lawMetadata.isNotYetInForce ?? false}
                effectiveDate={lawMetadata.effectiveDateFormatted}
              />
            </div>
          </div>
        </div>

        {/* Quick Info Bar */}
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-t pt-4">
          {formattedPublicationDate && (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              <span>Publicerad {formattedPublicationDate}</span>
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <VersionSelector
              lawSlug={law.slug}
              lawSfs={law.document_number.replace(/^SFS\s*/, '')}
              isWorkspace
            />
            {law.source_url && (
              <a
                href={law.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-1.5 hover:underline',
                  theme.accent
                )}
              >
                <Building2 className="h-4 w-4" />
                <span>Riksdagen</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Law Metadata Card */}
      {(lawMetadata.department ||
        lawMetadata.issuedDate ||
        lawMetadata.amendedThrough ||
        lawMetadata.sfsrUrl) && (
        <Card>
          <CardContent className="p-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {lawMetadata.department && (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground shrink-0">
                    Departement:
                  </dt>
                  <dd className="font-medium">{lawMetadata.department}</dd>
                </div>
              )}
              {lawMetadata.issuedDate && (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground shrink-0">Utfärdad:</dt>
                  <dd className="font-medium">{lawMetadata.issuedDate}</dd>
                </div>
              )}
              {lawMetadata.amendedThrough && (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground shrink-0">
                    Ändrad t.o.m:
                  </dt>
                  <dd className="font-medium">
                    SFS {lawMetadata.amendedThrough}
                  </dd>
                </div>
              )}
              {lawMetadata.repealedDate && (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground shrink-0">Upphävd:</dt>
                  <dd className="font-medium text-red-600">
                    {lawMetadata.repealedDate}
                  </dd>
                </div>
              )}
              {lawMetadata.repealedBy && (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground shrink-0">
                    Upphävd genom:
                  </dt>
                  <dd className="font-medium">SFS {lawMetadata.repealedBy}</dd>
                </div>
              )}
            </dl>
            {(lawMetadata.sfsrUrl || lawMetadata.fulltextUrl) && (
              <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-sm">
                {lawMetadata.sfsrUrl && (
                  <a
                    href={lawMetadata.sfsrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    Ändringsregister (SFSR)
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {lawMetadata.fulltextUrl && (
                  <a
                    href={lawMetadata.fulltextUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    Fulltext (Regeringskansliet)
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Related Documents Summary */}
      <RelatedDocumentsSummary
        citingCases={citingCases}
        implementedDirectives={implementedDirectives}
        amendments={law.base_amendments.map((a) => ({
          id: a.id,
          title: a.amending_law_title,
          slug: a.amending_document?.slug ?? null,
          effectiveDate: a.effective_date
            ? typeof a.effective_date === 'string'
              ? a.effective_date
              : a.effective_date.toISOString()
            : null,
        }))}
        lawTitle={law.title}
        lawSlug={law.slug}
        isWorkspace
      />

      {/* Subject Tags */}
      {law.subjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {law.subjects.map((subject) => (
            <Badge
              key={subject.subject_code}
              variant="outline"
              className="text-xs"
            >
              {subject.subject_name}
            </Badge>
          ))}
        </div>
      )}

      {/* Summary Card */}
      {law.summary && (
        <Card className="border-l-4 border-l-primary/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-muted-foreground">
              Sammanfattning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground leading-relaxed">{law.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Law Content */}
      <LawSectionWithBanner
        htmlContent={
          sanitizedHtml ? rewriteLinksForWorkspace(sanitizedHtml) : ''
        }
        fallbackText={law.full_text}
        sourceUrl={law.source_url}
        isLawNotYetInForce={lawMetadata.isNotYetInForce ?? false}
      />

      {/* Footer */}
      <footer className="text-center text-sm text-muted-foreground py-4 border-t">
        <p>
          Källa:{' '}
          <a
            href={law.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Riksdagen (Svensk författningssamling)
          </a>
        </p>
      </footer>

      {/* Back to top button */}
      <BackToTopButton />

      {/* Floating references button */}
      <FloatingReferencesWrapper
        courtCaseCount={citingCases.totalCount}
        directiveCount={implementedDirectives.length}
      />

      {/* Prefetchers */}
      <RelatedDocsPrefetcher
        citingCases={citingCases.cases.map((c) => ({
          slug: c.slug,
          contentType: c.contentType,
        }))}
        implementedDirectives={implementedDirectives.map((d) => ({
          slug: d.slug,
        }))}
        amendments={law.base_amendments
          .filter((a) => a.amending_document?.slug)
          .map((a) => ({
            slug: a.amending_document?.slug ?? null,
          }))}
      />
      <TimelinePrefetcher lawSfs={law.document_number} lawSlug={law.slug} />
    </div>
  )
}

function StatusBadge({
  status,
  isNotYetInForce,
  effectiveDate,
}: {
  status: DocumentStatus
  isNotYetInForce?: boolean | undefined
  effectiveDate?: string | undefined
}) {
  // If law is not yet in force, show special badge
  if (isNotYetInForce && effectiveDate) {
    return (
      <Badge
        variant="outline"
        className="border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400"
      >
        Ikraft {effectiveDate}
      </Badge>
    )
  }

  const statusConfig: Record<
    DocumentStatus,
    {
      label: string
      variant: 'default' | 'secondary' | 'destructive' | 'outline'
    }
  > = {
    ACTIVE: { label: 'Gällande', variant: 'default' },
    REPEALED: { label: 'Upphävd', variant: 'destructive' },
    DRAFT: { label: 'Utkast', variant: 'secondary' },
    ARCHIVED: { label: 'Arkiverad', variant: 'outline' },
  }

  const config = statusConfig[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
