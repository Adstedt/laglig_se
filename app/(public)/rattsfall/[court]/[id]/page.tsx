import { notFound } from 'next/navigation'
import Link from 'next/link'
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
import {
  CalendarDays,
  Building2,
  ExternalLink,
  Users,
  ArrowUpRight,
} from 'lucide-react'
import { getDocumentTheme } from '@/lib/document-themes'
import { cn } from '@/lib/utils'

// ISR: Revalidate every hour
export const revalidate = 3600
export const dynamicParams = true

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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { court, id } = await params

  const courtInfo = COURT_URL_MAP[court]
  if (!courtInfo) {
    return { title: 'Rättsfall hittades inte | Laglig.se' }
  }

  const document = await prisma.legalDocument.findUnique({
    where: { slug: id, content_type: courtInfo.contentType },
    select: {
      title: true,
      document_number: true,
      summary: true,
      full_text: true,
      slug: true,
      court_case: {
        select: {
          court_name: true,
          case_number: true,
        },
      },
    },
  })

  if (!document) {
    return { title: 'Rättsfall hittades inte | Laglig.se' }
  }

  const courtCase = document.court_case
  const title = courtCase
    ? `${courtCase.court_name} ${courtCase.case_number}`
    : document.title
  const description =
    document.summary?.substring(0, 155) ||
    document.full_text?.substring(0, 155) ||
    `Läs rättsfallet ${title} i sin helhet`
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'

  return {
    title: `${title} | Laglig.se`,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `${baseUrl}/rattsfall/${court}/${document.slug}`,
      siteName: 'Laglig.se',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `${baseUrl}/rattsfall/${court}/${document.slug}`,
    },
  }
}

export default async function CourtCasePage({ params }: PageProps) {
  const { court, id } = await params

  const courtInfo = COURT_URL_MAP[court]
  if (!courtInfo) {
    notFound()
  }

  const document = await prisma.legalDocument.findUnique({
    where: { slug: id, content_type: courtInfo.contentType },
    include: {
      court_case: true,
      source_references: {
        where: {
          target_document: {
            content_type: ContentType.SFS_LAW,
          },
        },
        include: {
          target_document: {
            select: {
              id: true,
              title: true,
              slug: true,
              document_number: true,
            },
          },
        },
        take: 20,
      },
    },
  })

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
          a: ['href', 'name', 'class'],
          '*': ['class', 'id', 'name'],
        },
      })
    : null

  const formattedDecisionDate = courtCase?.decision_date
    ? new Date(courtCase.decision_date).toLocaleDateString('sv-SE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

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

  // JSON-LD structured data
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LegalCase',
    name: courtCase
      ? `${courtCase.court_name} ${courtCase.case_number}`
      : document.title,
    identifier: courtCase?.case_number || document.document_number,
    datePublished: document.publication_date?.toISOString(),
    inLanguage: 'sv',
    court: {
      '@type': 'GovernmentOrganization',
      name: courtCase?.court_name || courtInfo.name,
    },
    url: `${baseUrl}/rattsfall/${court}/${document.slug}`,
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
                <BreadcrumbLink href="/rattsfall">Rättsfall</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={`/rattsfall/${court}`}>
                  {courtInfo.name}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="max-w-[150px] truncate md:max-w-none">
                  {courtCase?.case_number || document.document_number}
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

          {/* Case Details */}
          {(parties?.plaintiff || parties?.defendant) && (
            <Card className="mb-6 border-l-4 border-l-primary/50">
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
            <Card className="mb-8 border-l-4 border-l-primary/50">
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
          <Card className="mb-8">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="text-lg">Domslut</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <article className="legal-document p-6 md:p-8">
                {sanitizedHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
                ) : document.full_text ? (
                  <div className="whitespace-pre-wrap font-serif">
                    {document.full_text}
                  </div>
                ) : (
                  <p className="italic text-muted-foreground py-8 text-center">
                    Ingen domtext tillgänglig.{' '}
                    <a
                      href={document.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Läs på källan →
                    </a>
                  </p>
                )}
              </article>
            </CardContent>
          </Card>

          {/* Cited Laws Section */}
          {document.source_references.length > 0 && (
            <Card className="mb-8">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-lg">
                  Citerade lagar ({document.source_references.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {document.source_references.map((ref) => (
                    <Link
                      key={ref.id}
                      href={`/lagar/${ref.target_document.slug}`}
                      className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-foreground group-hover:text-primary line-clamp-1">
                          {ref.target_document.title}
                        </span>
                        <span className="ml-2 text-sm text-muted-foreground font-mono">
                          ({ref.target_document.document_number})
                        </span>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 ml-2" />
                    </Link>
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
                href={document.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {courtInfo.name}
              </a>
            </p>
          </footer>
        </div>
      </main>
    </>
  )
}
