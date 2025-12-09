import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ContentType } from '@prisma/client'
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
import { CalendarDays, ExternalLink, FileText } from 'lucide-react'
import { getDocumentTheme } from '@/lib/document-themes'
import { cn } from '@/lib/utils'
import { LinkedSwedishLaws } from '@/components/features/cross-references'
import { lookupLawBySfsNumber } from '@/app/actions/cross-references'
import { ContentWithStyledHeadings } from '@/components/features/content'
import { BackToTopButton } from '@/app/(public)/lagar/[id]/toc-client'
import { FloatingImplementationsButton } from './floating-implementations-button'

// ISR: Revalidate every hour
export const revalidate = 3600
export const dynamicParams = true

// EU type URL mapping
const EU_TYPE_MAP: Record<string, { contentType: ContentType; name: string; namePlural: string }> = {
  forordningar: { contentType: ContentType.EU_REGULATION, name: 'EU-förordning', namePlural: 'EU-förordningar' },
  direktiv: { contentType: ContentType.EU_DIRECTIVE, name: 'EU-direktiv', namePlural: 'EU-direktiv' },
}

interface PageProps {
  params: Promise<{ type: string; id: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { type, id } = await params

  const typeInfo = EU_TYPE_MAP[type]
  if (!typeInfo) {
    return { title: 'EU-dokument hittades inte | Laglig.se' }
  }

  const document = await prisma.legalDocument.findUnique({
    where: { slug: id, content_type: typeInfo.contentType },
    select: {
      title: true,
      document_number: true,
      summary: true,
      full_text: true,
      slug: true,
      eu_document: {
        select: {
          celex_number: true,
        },
      },
    },
  })

  if (!document) {
    return { title: 'EU-dokument hittades inte | Laglig.se' }
  }

  const description =
    document.summary?.substring(0, 155) ||
    document.full_text?.substring(0, 155) ||
    `Läs ${document.title} i sin helhet`
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'

  return {
    title: `${document.title} | Laglig.se`,
    description,
    openGraph: {
      title: document.title,
      description,
      type: 'article',
      url: `${baseUrl}/eu/${type}/${document.slug}`,
      siteName: 'Laglig.se',
    },
    twitter: {
      card: 'summary_large_image',
      title: document.title,
      description,
    },
    alternates: {
      canonical: `${baseUrl}/eu/${type}/${document.slug}`,
    },
  }
}

export default async function EuDocumentPage({ params }: PageProps) {
  const { type, id } = await params

  const typeInfo = EU_TYPE_MAP[type]
  if (!typeInfo) {
    notFound()
  }

  const document = await prisma.legalDocument.findUnique({
    where: { slug: id, content_type: typeInfo.contentType },
    include: {
      eu_document: true,
    },
  })

  if (!document) {
    notFound()
  }

  const euDoc = document.eu_document

  // Get theme for EU documents (purple)
  const theme = getDocumentTheme(typeInfo.contentType)
  const ThemeIcon = theme.icon

  // Parse national implementation measures
  const nimData = euDoc?.national_implementation_measures as {
    sweden?: {
      measures: Array<{
        sfs_number: string
        title: string
      }>
    }
  } | null

  // Look up slugs for each measure in parallel
  const measuresWithSlugs = await Promise.all(
    (nimData?.sweden?.measures || []).map(async (measure) => {
      const lawInfo = await lookupLawBySfsNumber(measure.sfs_number)
      return {
        sfs_number: measure.sfs_number,
        title: measure.title || lawInfo?.title,
        slug: lawInfo?.slug ?? null,
      }
    })
  )

  // Sanitize HTML content
  const sanitizedHtml = document.html_content
    ? sanitizeHtml(document.html_content, {
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

  const formattedPublicationDate = document.publication_date
    ? new Date(document.publication_date).toLocaleDateString('sv-SE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  // JSON-LD structured data
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Legislation',
    name: document.title,
    identifier: euDoc?.celex_number || document.document_number,
    legislationIdentifier: euDoc?.celex_number,
    datePublished: document.publication_date?.toISOString(),
    inLanguage: 'sv',
    legislationType: type === 'forordningar' ? 'Regulation' : 'Directive',
    legislationJurisdiction: {
      '@type': 'GovernmentalAdministrativeRegion',
      name: 'European Union',
    },
    publisher: {
      '@type': 'GovernmentOrganization',
      name: 'European Union',
    },
    url: `${baseUrl}/eu/${type}/${document.slug}`,
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
                <BreadcrumbLink href="/eu">EU-lagstiftning</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={`/eu/${type}`}>
                  {typeInfo.namePlural}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="max-w-[150px] truncate md:max-w-none">
                  {document.document_number}
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
                  {document.title}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge className={cn('gap-1', theme.badge)}>
                    <ThemeIcon className="h-3.5 w-3.5" />
                    {typeInfo.name}
                  </Badge>
                  {euDoc?.celex_number && (
                    <Badge variant="outline" className="font-mono text-sm">
                      CELEX: {euDoc.celex_number}
                    </Badge>
                  )}
                  {euDoc?.eut_reference && (
                    <Badge variant="outline" className="font-mono text-sm">
                      EUT: {euDoc.eut_reference}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Info Bar */}
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground border-t pt-4">
              <div className="flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                <span>{document.document_number}</span>
              </div>
              {formattedPublicationDate && (
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  <span>Publicerad {formattedPublicationDate}</span>
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
                  <span>EUR-Lex</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </header>

          {/* Summary Card */}
          {document.summary && (
            <Card className="mb-8 border-l-4 border-l-purple-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-muted-foreground">
                  Sammanfattning
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground leading-relaxed">{document.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Swedish Implementation (for directives) - with links to law pages */}
          {type === 'direktiv' && measuresWithSlugs.length > 0 && (
            <LinkedSwedishLaws measures={measuresWithSlugs} />
          )}

          {/* Document content */}
          <Card className="mb-8">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="text-lg">Dokumenttext</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <article className="legal-document p-6 md:p-8">
                {sanitizedHtml ? (
                  <ContentWithStyledHeadings htmlContent={sanitizedHtml} />
                ) : document.full_text ? (
                  <div className="whitespace-pre-wrap font-serif">{document.full_text}</div>
                ) : (
                  <p className="italic text-muted-foreground py-8 text-center">
                    Ingen dokumenttext tillgänglig.{' '}
                    <a
                      href={document.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Läs på EUR-Lex →
                    </a>
                  </p>
                )}
              </article>
            </CardContent>
          </Card>

          {/* Footer */}
          <footer className="text-center text-sm text-muted-foreground py-4 border-t">
            <p>
              Källa:{' '}
              <a
                href={document.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                EUR-Lex (Europeiska unionens publikationsbyrå)
              </a>
            </p>
          </footer>
        </div>

        {/* Back to top button */}
        <BackToTopButton />

        {/* Floating button for Swedish implementations (directives only) */}
        {type === 'direktiv' && (
          <FloatingImplementationsButton implementationCount={measuresWithSlugs.length} />
        )}
      </main>
    </>
  )
}
