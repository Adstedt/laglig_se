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

const COURT_URL_MAP: Record<string, { contentType: ContentType; name: string }> = {
  hd: { contentType: ContentType.COURT_CASE_HD, name: 'Högsta domstolen' },
  hovr: { contentType: ContentType.COURT_CASE_HOVR, name: 'Hovrätten' },
  hfd: { contentType: ContentType.COURT_CASE_HFD, name: 'Högsta förvaltningsdomstolen' },
  ad: { contentType: ContentType.COURT_CASE_AD, name: 'Arbetsdomstolen' },
  mod: { contentType: ContentType.COURT_CASE_MOD, name: 'Mark- och miljööverdomstolen' },
  mig: { contentType: ContentType.COURT_CASE_MIG, name: 'Migrationsöverdomstolen' },
}

interface PageProps {
  params: Promise<{ court: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { court } = await params
  const courtInfo = COURT_URL_MAP[court]

  if (!courtInfo) {
    return { title: 'Domstol hittades inte | Laglig.se' }
  }

  return {
    title: `Rättsfall från ${courtInfo.name} | Laglig.se`,
    description: `Utforska rättsfall och avgöranden från ${courtInfo.name}. Sök bland domar med full text.`,
    openGraph: {
      title: `Rättsfall från ${courtInfo.name} | Laglig.se`,
      description: `Utforska rättsfall och avgöranden från ${courtInfo.name}.`,
      type: 'website',
    },
  }
}

export default async function CourtListingPage({ params }: PageProps) {
  const { court } = await params

  const courtInfo = COURT_URL_MAP[court]
  if (!courtInfo) {
    notFound()
  }

  const recentCases = await prisma.legalDocument.findMany({
    where: { content_type: courtInfo.contentType },
    orderBy: { publication_date: 'desc' },
    take: 20,
    select: {
      id: true,
      title: true,
      slug: true,
      document_number: true,
      publication_date: true,
      summary: true,
      court_case: {
        select: {
          case_number: true,
          decision_date: true,
        },
      },
    },
  })

  const totalCount = await prisma.legalDocument.count({
    where: { content_type: courtInfo.contentType },
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
            <BreadcrumbLink href="/rattsfall">Rättsfall</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{courtInfo.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold">{courtInfo.name}</h1>
        <p className="mt-2 text-muted-foreground">
          {totalCount.toLocaleString('sv-SE')} rättsfall
        </p>
      </header>

      {/* Cases list */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Senaste avgöranden</h2>
        <div className="space-y-4">
          {recentCases.map((doc) => (
            <Card key={doc.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-lg">
                    <Link
                      href={`/rattsfall/${court}/${doc.slug}`}
                      className="hover:text-primary hover:underline"
                    >
                      {doc.title}
                    </Link>
                  </CardTitle>
                  {doc.court_case?.case_number && (
                    <Badge variant="outline" className="shrink-0 font-mono">
                      {doc.court_case.case_number}
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
                {doc.court_case?.decision_date && (
                  <p className="text-xs text-muted-foreground">
                    Avgörandedatum:{' '}
                    {new Date(doc.court_case.decision_date).toLocaleDateString(
                      'sv-SE'
                    )}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  )
}
