import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ContentType, DocumentStatus } from '@prisma/client'
import type { Metadata } from 'next'
import sanitizeHtml from 'sanitize-html'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays, Building2, ExternalLink } from 'lucide-react'
import { LawTableOfContents, BackToTopButton } from './toc-client'
import { getDocumentTheme } from '@/lib/document-themes'
import { cn } from '@/lib/utils'

// ISR: Revalidate every hour - NOT generateStaticParams() for 88K+ docs
export const revalidate = 3600
export const dynamicParams = true

interface PageProps {
  params: Promise<{ id: string }>
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params
  const law = await prisma.legalDocument.findUnique({
    where: { slug: id, content_type: ContentType.SFS_LAW },
    select: {
      title: true,
      document_number: true,
      summary: true,
      full_text: true,
      slug: true,
    },
  })

  if (!law) {
    return {
      title: 'Lag hittades inte | Laglig.se',
    }
  }

  const description =
    law.summary?.substring(0, 155) ||
    law.full_text?.substring(0, 155) ||
    `Läs ${law.title} i sin helhet på Laglig.se`
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'

  return {
    title: `${law.title} - ${law.document_number} | Laglig.se`,
    description,
    openGraph: {
      title: law.title,
      description,
      type: 'article',
      url: `${baseUrl}/lagar/${law.slug}`,
      siteName: 'Laglig.se',
    },
    twitter: {
      card: 'summary_large_image',
      title: law.title,
      description,
    },
    alternates: {
      canonical: `${baseUrl}/lagar/${law.slug}`,
    },
  }
}

// Clean HTML from Riksdagen - remove metadata block, keep only law text
function cleanLawHtml(html: string): string {
  // Remove the header/metadata section that duplicates our UI
  // Pattern: Everything from start until after the <hr /> before actual content
  let cleaned = html

  // Remove the title h2 at the start (we show it in our header)
  cleaned = cleaned.replace(/^<h2>[^<]+<\/h2>\s*/i, '')

  // Remove metadata block (SFS nr, Departement, etc.) - everything before first <hr />
  const hrIndex = cleaned.indexOf('<hr')
  if (hrIndex !== -1) {
    // Find the end of the hr tag
    const hrEndIndex = cleaned.indexOf('>', hrIndex)
    if (hrEndIndex !== -1) {
      cleaned = cleaned.substring(hrEndIndex + 1)
    }
  }

  // Clean up leading whitespace and empty divs
  cleaned = cleaned.replace(/^\s*<br\s*\/?>\s*/gi, '')

  // Remove all hr tags - we use CSS borders for visual separation instead
  cleaned = cleaned.replace(/<hr\s*\/?>/gi, '')

  // Remove lone dots after </i> tags (Riksdagen artifact: "</i>.<p>")
  cleaned = cleaned.replace(/<\/i>\s*\.\s*(?=<)/gi, '</i>')

  // Remove lone dots that appear as paragraphs (artifact from Riksdagen HTML)
  cleaned = cleaned.replace(/<p>\s*\.\s*<\/p>/gi, '')

  // Remove empty paragraphs
  cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '')

  // Remove paragraphs that only contain <br> tags
  cleaned = cleaned.replace(/<p>\s*(<br\s*\/?>)+\s*<\/p>/gi, '')

  cleaned = cleaned.trim()

  return cleaned
}

// Extract effective date from HTML content
function extractEffectiveDate(html: string): string | null {
  // Pattern: /Träder i kraft I:YYYY-MM-DD/
  const match = html.match(/Träder i kraft[^:]*:?\s*(\d{4}-\d{2}-\d{2})/i)
  return match?.[1] ?? null
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
}

function extractLawMetadata(html: string): LawMetadata {
  const metadata: LawMetadata = {}

  // Get the metadata block (before first <hr>)
  const hrIndex = html.indexOf('<hr')
  if (hrIndex === -1) return metadata

  const metaBlock = html.substring(0, hrIndex)

  // Extract Departement/myndighet (handles <b> or <strong> tags, with whitespace)
  const deptMatch = metaBlock.match(
    /Departement\/myndighet<\/(?:b|strong)>:\s*\n?\s*([^<\n]+)/i
  )
  if (deptMatch?.[1]) metadata.department = deptMatch[1].trim()

  // Extract Utfärdad date
  const issuedMatch = metaBlock.match(
    /Utfärdad<\/(?:b|strong)>:\s*\n?\s*(\d{4}-\d{2}-\d{2})/i
  )
  if (issuedMatch?.[1]) metadata.issuedDate = issuedMatch[1]

  // Extract Ändrad t.o.m. (with or without dot after "m", no "SFS" prefix in some)
  const amendedMatch = metaBlock.match(
    /Ändrad<\/(?:b|strong)>:\s*\n?\s*t\.o\.m\.?\s*(?:SFS\s*)?(\d{4}:\d+)/i
  )
  if (amendedMatch?.[1]) metadata.amendedThrough = amendedMatch[1]

  // Extract Upphävd date
  const repealedMatch = metaBlock.match(
    /Upphävd<\/(?:b|strong)>:\s*\n?\s*(\d{4}-\d{2}-\d{2})/i
  )
  if (repealedMatch?.[1]) metadata.repealedDate = repealedMatch[1]

  // Extract "Författningen har upphävts genom" SFS number
  const repealedByMatch = metaBlock.match(
    /har upphävts genom<\/(?:b|strong)>:\s*\n?\s*(?:SFS\s*)?(\d{4}:\d+)/i
  )
  if (repealedByMatch?.[1]) metadata.repealedBy = repealedByMatch[1]

  // Extract SFSR link (both http and https)
  const sfsrMatch = metaBlock.match(
    /href="(https?:\/\/rkrattsbaser\.gov\.se\/sfsr[^"]+)"/i
  )
  if (sfsrMatch?.[1]) metadata.sfsrUrl = sfsrMatch[1]

  // Extract Fulltext link (both http and https)
  const fulltextMatch = metaBlock.match(
    /href="(https?:\/\/rkrattsbaser\.gov\.se\/sfst[^"]+)"/i
  )
  if (fulltextMatch?.[1]) metadata.fulltextUrl = fulltextMatch[1]

  return metadata
}

export default async function LawPage({ params }: PageProps) {
  const { id } = await params

  const law = await prisma.legalDocument.findUnique({
    where: { slug: id, content_type: ContentType.SFS_LAW },
    include: {
      subjects: {
        select: {
          subject_code: true,
          subject_name: true,
        },
      },
      base_amendments: {
        include: {
          amending_document: {
            select: {
              slug: true,
              document_number: true,
              title: true,
            },
          },
        },
        orderBy: { effective_date: 'desc' },
        take: 10,
      },
    },
  })

  if (!law) {
    notFound()
  }

  // Extract effective date from HTML if not in database
  const htmlEffectiveDate = law.html_content
    ? extractEffectiveDate(law.html_content)
    : null

  // Clean and sanitize HTML content
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
          a: ['href', 'name', 'class'],
          '*': ['class', 'id', 'name'],
        },
      })
    : null

  const formattedPublicationDate = law.publication_date
    ? new Date(law.publication_date).toLocaleDateString('sv-SE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const effectiveDateDisplay = law.effective_date
    ? new Date(law.effective_date).toLocaleDateString('sv-SE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : htmlEffectiveDate
      ? new Date(htmlEffectiveDate).toLocaleDateString('sv-SE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : null

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Legislation',
    name: law.title,
    identifier: law.document_number,
    legislationIdentifier: law.document_number,
    datePublished: law.publication_date?.toISOString(),
    dateEnacted: law.effective_date?.toISOString(),
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

  // Get theme for SFS laws (amber)
  const theme = getDocumentTheme('SFS_LAW')
  const ThemeIcon = theme.icon

  // Extract metadata from HTML
  const lawMetadata = law.html_content
    ? extractLawMetadata(law.html_content)
    : {}

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto max-w-4xl px-4 py-6">
          {/* Breadcrumbs */}
          <Breadcrumb className="mb-6">
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

          {/* Hero Header - with theme accent */}
          <header className="mb-8 rounded-xl bg-card p-6 shadow-sm border">
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
                <h1 className="text-xl font-bold text-foreground sm:text-2xl md:text-3xl leading-tight">
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
                  <StatusBadge status={law.status} />
                </div>
              </div>
            </div>

            {/* Quick Info Bar */}
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground border-t pt-4">
              {formattedPublicationDate && (
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  <span>Publicerad {formattedPublicationDate}</span>
                </div>
              )}
              {effectiveDateDisplay && (
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-green-600" />
                  <span className="text-green-700 font-medium">
                    Träder i kraft {effectiveDateDisplay}
                  </span>
                </div>
              )}
              {law.source_url && (
                <a
                  href={law.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex items-center gap-1.5 hover:underline ml-auto',
                    theme.accent
                  )}
                >
                  <Building2 className="h-4 w-4" />
                  <span>Riksdagen</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </header>

          {/* Law Metadata Card */}
          {(lawMetadata.department ||
            lawMetadata.issuedDate ||
            lawMetadata.amendedThrough ||
            lawMetadata.sfsrUrl) && (
            <Card className="mb-6">
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
                      <dt className="text-muted-foreground shrink-0">
                        Utfärdad:
                      </dt>
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
                      <dt className="text-muted-foreground shrink-0">
                        Upphävd:
                      </dt>
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
                      <dd className="font-medium">
                        SFS {lawMetadata.repealedBy}
                      </dd>
                    </div>
                  )}
                </dl>
                {/* External links */}
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

          {/* Subject Tags */}
          {law.subjects.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
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
            <Card className="mb-8 border-l-4 border-l-primary/50">
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
          <Card className="mb-8">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="text-lg">Lagtext</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <article className="legal-document p-6 md:p-8">
                {sanitizedHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
                ) : law.full_text ? (
                  <div className="whitespace-pre-wrap font-serif">
                    {law.full_text}
                  </div>
                ) : (
                  <p className="italic text-muted-foreground py-8 text-center">
                    Ingen lagtext tillgänglig.{' '}
                    <a
                      href={law.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Läs på Riksdagen →
                    </a>
                  </p>
                )}
              </article>
            </CardContent>
          </Card>

          {/* Amendments Section */}
          {law.base_amendments.length > 0 && (
            <Card className="mb-8">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-lg">
                  Ändringar ({law.base_amendments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {law.base_amendments.map((amendment) => (
                    <div
                      key={amendment.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        {amendment.amending_document ? (
                          <Link
                            href={`/lagar/${amendment.amending_document.slug}`}
                            className="font-medium text-primary hover:underline line-clamp-1"
                          >
                            {amendment.amending_law_title}
                          </Link>
                        ) : (
                          <span className="font-medium line-clamp-1">
                            {amendment.amending_law_title}
                          </span>
                        )}
                      </div>
                      <div className="ml-4 shrink-0 text-sm text-muted-foreground">
                        {amendment.effective_date
                          ? new Date(
                              amendment.effective_date
                            ).toLocaleDateString('sv-SE')
                          : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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
        </div>

        {/* Table of Contents (client component) */}
        <LawTableOfContents />

        {/* Back to top button */}
        <BackToTopButton />
      </main>
    </>
  )
}

function StatusBadge({ status }: { status: DocumentStatus }) {
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
