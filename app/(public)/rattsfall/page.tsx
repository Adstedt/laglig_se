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

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Svenska rättsfall | Laglig.se',
  description:
    'Utforska svenska rättsfall från Högsta domstolen, Hovrätten, Högsta förvaltningsdomstolen och fler domstolar.',
  openGraph: {
    title: 'Svenska rättsfall | Laglig.se',
    description:
      'Utforska svenska rättsfall från alla domstolar.',
    type: 'website',
  },
}

const COURTS = [
  { slug: 'hd', name: 'Högsta domstolen', contentType: ContentType.COURT_CASE_HD },
  { slug: 'hovr', name: 'Hovrätten', contentType: ContentType.COURT_CASE_HOVR },
  { slug: 'hfd', name: 'Högsta förvaltningsdomstolen', contentType: ContentType.COURT_CASE_HFD },
  { slug: 'ad', name: 'Arbetsdomstolen', contentType: ContentType.COURT_CASE_AD },
  { slug: 'mod', name: 'Mark- och miljööverdomstolen', contentType: ContentType.COURT_CASE_MOD },
  { slug: 'mig', name: 'Migrationsöverdomstolen', contentType: ContentType.COURT_CASE_MIG },
]

export default async function CourtCasesIndexPage() {
  // Get counts for each court type
  const courtCounts = await Promise.all(
    COURTS.map(async (court) => {
      const count = await prisma.legalDocument.count({
        where: { content_type: court.contentType },
      })
      return { ...court, count }
    })
  )

  const totalCount = courtCounts.reduce((sum, c) => sum + c.count, 0)

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
            <BreadcrumbPage>Rättsfall</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Svenska rättsfall</h1>
        <p className="mt-2 text-muted-foreground">
          Utforska {totalCount.toLocaleString('sv-SE')} rättsfall från svenska
          domstolar
        </p>
      </header>

      {/* Courts grid */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Välj domstol</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {courtCounts.map((court) => (
            <Card key={court.slug} className="transition-shadow hover:shadow-md">
              <Link href={`/rattsfall/${court.slug}`}>
                <CardHeader>
                  <CardTitle className="text-lg">{court.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {court.count.toLocaleString('sv-SE')} rättsfall
                  </p>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      </section>
    </main>
  )
}
