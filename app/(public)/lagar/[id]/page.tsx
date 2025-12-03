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
import { CalendarDays, Building2, ExternalLink, Scale } from 'lucide-react'

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
  cleaned = cleaned.trim()

  return cleaned
}

// Extract effective date from HTML content
function extractEffectiveDate(html: string): string | null {
  // Pattern: /Träder i kraft I:YYYY-MM-DD/
  const match = html.match(/Träder i kraft[^:]*:?\s*(\d{4}-\d{2}-\d{2})/i)
  return match ? match[1] : null
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
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'ul', 'ol', 'li',
          'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'strong', 'em',
          'span', 'div', 'blockquote', 'pre', 'code', 'b', 'i', 'u', 'sub', 'sup',
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

          {/* Hero Header */}
          <header className="mb-8 rounded-xl bg-card p-6 shadow-sm border">
            <div className="flex items-start gap-4">
              <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Scale className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-foreground sm:text-2xl md:text-3xl leading-tight">
                  {law.title}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
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
                  className="flex items-center gap-1.5 text-primary hover:underline ml-auto"
                >
                  <Building2 className="h-4 w-4" />
                  <span>Riksdagen</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </header>

          {/* Subject Tags */}
          {law.subjects.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {law.subjects.map((subject) => (
                <Badge key={subject.subject_code} variant="outline" className="text-xs">
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
                  <div className="whitespace-pre-wrap font-serif">{law.full_text}</div>
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
                <CardTitle className="text-lg">Ändringar ({law.base_amendments.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {law.base_amendments.map((amendment) => (
                    <div key={amendment.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
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
                          ? new Date(amendment.effective_date).toLocaleDateString('sv-SE')
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
      </main>
    </>
  )
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const statusConfig: Record<
    DocumentStatus,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    ACTIVE: { label: 'Gällande', variant: 'default' },
    REPEALED: { label: 'Upphävd', variant: 'destructive' },
    DRAFT: { label: 'Utkast', variant: 'secondary' },
    ARCHIVED: { label: 'Arkiverad', variant: 'outline' },
  }

  const config = statusConfig[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
