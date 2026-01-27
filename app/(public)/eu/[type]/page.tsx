import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ContentType } from '@prisma/client'
import type { Metadata } from 'next'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const revalidate = 3600
export const dynamicParams = true

const EU_TYPE_MAP: Record<
  string,
  { contentType: ContentType; name: string; namePlural: string }
> = {
  forordningar: {
    contentType: ContentType.EU_REGULATION,
    name: 'EU-förordning',
    namePlural: 'EU-förordningar',
  },
  direktiv: {
    contentType: ContentType.EU_DIRECTIVE,
    name: 'EU-direktiv',
    namePlural: 'EU-direktiv',
  },
}

interface PageProps {
  params: Promise<{ type: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { type } = await params
  const typeInfo = EU_TYPE_MAP[type]

  if (!typeInfo) {
    return { title: 'Typ hittades inte | Laglig.se' }
  }

  return {
    title: `${typeInfo.namePlural} | Laglig.se`,
    description: `Utforska ${typeInfo.namePlural.toLowerCase()} som gäller i Sverige. Sök bland EU-lagstiftning med svensk text.`,
    openGraph: {
      title: `${typeInfo.namePlural} | Laglig.se`,
      description: `Utforska ${typeInfo.namePlural.toLowerCase()} som gäller i Sverige.`,
      type: 'website',
    },
  }
}

export default async function EuTypeListingPage({ params }: PageProps) {
  const { type } = await params

  const typeInfo = EU_TYPE_MAP[type]
  if (!typeInfo) {
    notFound()
  }

  const recentDocs = await prisma.legalDocument.findMany({
    where: { content_type: typeInfo.contentType },
    orderBy: { publication_date: 'desc' },
    take: 20,
    select: {
      id: true,
      title: true,
      slug: true,
      document_number: true,
      publication_date: true,
      summary: true,
      eu_document: {
        select: {
          celex_number: true,
        },
      },
    },
  })

  const totalCount = await prisma.legalDocument.count({
    where: { content_type: typeInfo.contentType },
  })

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
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
            <BreadcrumbPage>{typeInfo.namePlural}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold">{typeInfo.namePlural}</h1>
        <p className="mt-2 text-muted-foreground">
          {totalCount.toLocaleString('sv-SE')} dokument
        </p>
      </header>

      {/* Documents list */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Senaste dokument</h2>
        <div className="space-y-4">
          {recentDocs.map((doc) => (
            <Card key={doc.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-lg">
                    <Link
                      href={`/eu/${type}/${doc.slug}`}
                      className="hover:text-primary hover:underline"
                    >
                      {doc.title}
                    </Link>
                  </CardTitle>
                  {doc.eu_document?.celex_number && (
                    <Badge
                      variant="outline"
                      className="shrink-0 font-mono text-xs"
                    >
                      {doc.eu_document.celex_number}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {doc.summary && (
                  <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">
                    {doc.summary}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{doc.document_number}</span>
                  {doc.publication_date && (
                    <span>
                      {new Date(doc.publication_date).toLocaleDateString(
                        'sv-SE'
                      )}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  )
}
