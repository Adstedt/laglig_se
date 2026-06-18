import { notFound } from 'next/navigation'
import { DocumentStatus } from '@prisma/client'
import type { Metadata } from 'next'
import sanitizeHtml from 'sanitize-html'
import { getCachedLaw, getCachedLawMetadata } from '@/lib/cache/cached-queries'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import {
  CalendarDays,
  Building2,
  ExternalLink,
  Info,
  FileText,
} from 'lucide-react'
import { BackToTopButton } from './toc-client'
import {
  LawDocumentContent,
  NotYetInForceBanner,
  RelatedDocsPrefetcher,
  TimelinePrefetcher,
} from '@/components/features/law'
import {
  DocumentHero,
  type DocumentStatusBadge,
} from '@/components/features/document-hero'
import { DocumentPageLayout } from '@/components/features/document-page-layout'
import { DocumentIntroAccordion } from '@/components/features/document-intro'
import { getImplementedEuDirectives } from '@/app/actions/cross-references'
import { cleanLawHtml } from '@/lib/sfs/clean-law-html'
import { getLatestAmendmentSfs } from '@/lib/sfs/latest-amendment'
import { getOfficialSfsSource } from '@/lib/sfs/official-source'
import { buildSeoDescription, documentSeoTitle } from '@/lib/seo/meta'

// ISR: Revalidate every hour
// Static generation for top 500 laws (Story 2.19)
export const revalidate = 3600
export const dynamicParams = true // Allow ISR for non-pre-generated pages

function toISOStringOrUndefined(
  date: Date | string | null | undefined
): string | undefined {
  if (!date) return undefined
  if (typeof date === 'string') return date
  if (date instanceof Date) return date.toISOString()
  return undefined
}

function formatDateOrNull(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions
): string | null {
  if (!date) return null
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString('sv-SE', options)
}

/**
 * Pre-generate top 50 law pages at build time for better performance
 */
export async function generateStaticParams() {
  if (process.env.NODE_ENV !== 'production') {
    return []
  }

  try {
    const { getTopLawsForStaticGeneration } = await import(
      '@/lib/cache/cached-queries'
    )
    const topLaws = await getTopLawsForStaticGeneration(50)
    return topLaws.map((law) => ({ id: law.slug }))
  } catch (error) {
    console.error('[generateStaticParams] Error fetching top laws:', error)
    return []
  }
}

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params
  const law = await getCachedLawMetadata(id)

  if (!law) {
    return { title: 'Lag hittades inte' }
  }

  const title = documentSeoTitle(law.title, law.document_number)
  const description = buildSeoDescription({
    summary: law.summary,
    applicabilityHint: law.applicability_hint,
    fullText: law.full_text,
    fallback: `Läs ${law.title} i fulltext på Laglig.se – uppdaterad lagtext med ändringar, paragraf för paragraf.`,
  })
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `${baseUrl}/lagar/${law.slug}`,
      siteName: 'Laglig.se',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `${baseUrl}/lagar/${law.slug}`,
    },
  }
}

// Extract metadata from Riksdagen HTML header
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
      {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }
    )

    metadata.isNotYetInForce = effectiveDate > today
  }

  return metadata
}

/** Map DocumentStatus + not-yet-in-force flag into the DocumentHero status badge type */
function resolveStatusBadge(
  status: DocumentStatus,
  isNotYetInForce: boolean,
  effectiveDateLabel: string | undefined
): DocumentStatusBadge | undefined {
  if (isNotYetInForce && effectiveDateLabel) {
    return { kind: 'not-in-force', effectiveDateLabel }
  }
  switch (status) {
    case 'ACTIVE':
      return { kind: 'active' }
    case 'REPEALED':
      return { kind: 'repealed' }
    case 'DRAFT':
      return { kind: 'draft' }
    case 'ARCHIVED':
      return { kind: 'archived' }
    default:
      return undefined
  }
}

export default async function LawPage({ params }: PageProps) {
  const { id } = await params

  const law = await getCachedLaw(id)

  if (!law) {
    notFound()
  }

  // Track visit for cache warming optimization (non-blocking)
  if (law.id) {
    import('@/app/actions/track-visit').then(({ trackDocumentVisit }) => {
      trackDocumentVisit(law.id).catch(() => {
        // Silently fail - tracking should never break the page
      })
    })
  }

  const implementedDirectives = await getImplementedEuDirectives(law.id)

  const cleanedHtml = law.html_content ? cleanLawHtml(law.html_content) : null
  const sanitizedHtml = cleanedHtml
    ? sanitizeHtml(cleanedHtml, {
        allowedTags: [
          'article',
          'section',
          'details',
          'summary',
          'footer',
          'nav',
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
          'dl',
          'dt',
          'dd',
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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Legislation',
    name: law.title,
    identifier: law.document_number,
    legislationIdentifier: law.document_number,
    datePublished: toISOStringOrUndefined(law.publication_date),
    dateEnacted: toISOStringOrUndefined(law.effective_date),
    inLanguage: 'sv',
    legislationType: 'Act',
    legislationJurisdiction: {
      '@type': 'Country',
      name: 'Sweden',
    },
    publisher: {
      '@type': 'GovernmentOrganization',
      name: 'Riksdagen',
    },
    url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'}/lagar/${law.slug}`,
  }

  const lawMetadata = law.html_content
    ? extractLawMetadata(law.html_content)
    : {}

  // Resolve "Ändrad t.o.m." — the single most legally important metadata.
  // Prefer tracked amendments (live data) when available; fall back to whatever
  // the HTML extraction found (older laws ingested with `<hr>`+<b>-format HTML
  // embed this; newer laws in `.lovhead` format don't).
  const amendedThroughSfs =
    getLatestAmendmentSfs(law.base_amendments) ??
    (lawMetadata.amendedThrough ? `SFS ${lawMetadata.amendedThrough}` : null)

  const statusBadge = resolveStatusBadge(
    law.status,
    lawMetadata.isNotYetInForce ?? false,
    lawMetadata.effectiveDateFormatted
  )

  // Prefer the authentic published text (svenskforfattningssamling PDF page for
  // 2018+, Regeringskansliet consolidated text for older laws) over the raw
  // Riksdagen data-API URL stored in source_url. Falls back to source_url only
  // for malformed/non-SFS numbers the resolver can't map.
  const officialSource = getOfficialSfsSource(
    law.document_number,
    law.publication_date,
    law.content_type
  ) ?? { url: law.source_url, label: 'Riksdagen' }

  const breadcrumbs = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Hem</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="/lagar">Lagar</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="max-w-[200px] truncate md:max-w-none">
            {law.document_number}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )

  const footer = (
    <footer className="text-center text-sm text-muted-foreground py-4 border-t">
      <p>
        Källa:{' '}
        <a
          href={officialSource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {officialSource.label}
        </a>
      </p>
    </footer>
  )

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <DocumentPageLayout breadcrumbs={breadcrumbs} footer={footer}>
        {/* Banner for laws not yet in force */}
        {lawMetadata.isNotYetInForce && lawMetadata.effectiveDateFormatted && (
          <NotYetInForceBanner
            effectiveDate={lawMetadata.effectiveDateFormatted}
            title={law.title}
          />
        )}

        {/* Hero Header */}
        <DocumentHero
          title={law.title}
          documentNumber={law.document_number}
          contentType="SFS_LAW"
          sfsInstrument={law.sfs_instrument}
          status={statusBadge}
          extraBadges={
            amendedThroughSfs ? (
              <span className="inline-flex items-center rounded-full bg-muted/70 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Ändrad t.o.m. {amendedThroughSfs}
              </span>
            ) : undefined
          }
          quickInfoItems={
            formattedPublicationDate
              ? [
                  {
                    icon: CalendarDays,
                    label: `Publicerad ${formattedPublicationDate}`,
                  },
                ]
              : []
          }
          actionLinks={
            officialSource.url
              ? [
                  {
                    href: officialSource.url,
                    label: officialSource.label,
                    icon: Building2,
                    external: true,
                  },
                ]
              : []
          }
        />

        {/* Intro accordion — Sammanfattning, Detaljer */}
        <DocumentIntroAccordion
          defaultValue={[]}
          items={[
            ...(law.summary
              ? [
                  {
                    value: 'summary',
                    label: (
                      <>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        Sammanfattning
                      </>
                    ),
                    children: (
                      <p className="leading-relaxed text-foreground/90">
                        {law.summary}
                      </p>
                    ),
                  },
                ]
              : []),
            ...(lawMetadata.department ||
            lawMetadata.issuedDate ||
            lawMetadata.sfsrUrl ||
            lawMetadata.repealedDate
              ? [
                  {
                    value: 'metadata',
                    label: (
                      <>
                        <Info className="h-4 w-4 text-muted-foreground" />
                        Detaljer
                      </>
                    ),
                    children: (
                      <>
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                          {lawMetadata.department && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted-foreground">
                                Departement:
                              </dt>
                              <dd className="font-medium">
                                {lawMetadata.department}
                              </dd>
                            </div>
                          )}
                          {lawMetadata.issuedDate && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted-foreground">
                                Utfärdad:
                              </dt>
                              <dd className="font-medium">
                                {lawMetadata.issuedDate}
                              </dd>
                            </div>
                          )}
                          {/* Ändrad t.o.m. is now surfaced as a hero pill — dropped here to avoid duplication */}
                          {lawMetadata.repealedDate && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted-foreground">
                                Upphävd:
                              </dt>
                              <dd className="font-medium text-red-600">
                                {lawMetadata.repealedDate}
                              </dd>
                            </div>
                          )}
                          {lawMetadata.repealedBy && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted-foreground">
                                Upphävd genom:
                              </dt>
                              <dd className="font-medium">
                                SFS {lawMetadata.repealedBy}
                              </dd>
                            </div>
                          )}
                        </dl>
                        {(lawMetadata.sfsrUrl || lawMetadata.fulltextUrl) && (
                          <div className="mt-3 flex flex-wrap gap-4 border-t border-border/60 pt-3 text-sm">
                            {lawMetadata.sfsrUrl && (
                              <a
                                href={lawMetadata.sfsrUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-primary hover:underline"
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
                                className="inline-flex items-center gap-1.5 text-primary hover:underline"
                              >
                                Fulltext (Regeringskansliet)
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </>
                    ),
                  },
                ]
              : []),
          ]}
        />

        {/* Subject tags — flat row */}
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

        {/* Law Content with Future Amendments Banner */}
        <LawDocumentContent
          htmlContent={sanitizedHtml ?? ''}
          fallbackText={law.full_text}
          sourceUrl={officialSource.url}
          sourceLabel={officialSource.label}
          isLawNotYetInForce={lawMetadata.isNotYetInForce ?? false}
        />

        {/* Back to top button */}
        <BackToTopButton />

        {/* Prefetch related documents */}
        <RelatedDocsPrefetcher
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
      </DocumentPageLayout>
    </>
  )
}
