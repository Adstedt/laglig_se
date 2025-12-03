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
  title: 'EU-lagstiftning | Laglig.se',
  description:
    'Utforska EU-förordningar och EU-direktiv som gäller i Sverige. Sök bland tusentals EU-rättsakter med svensk text.',
  openGraph: {
    title: 'EU-lagstiftning | Laglig.se',
    description:
      'Utforska EU-förordningar och EU-direktiv som gäller i Sverige.',
    type: 'website',
  },
}

const EU_TYPES = [
  { slug: 'forordningar', name: 'EU-förordningar', contentType: ContentType.EU_REGULATION, description: 'Direkt gällande EU-lagstiftning' },
  { slug: 'direktiv', name: 'EU-direktiv', contentType: ContentType.EU_DIRECTIVE, description: 'Kräver nationell implementering' },
]

export default async function EuIndexPage() {
  // Get counts for each EU type
  const typeCounts = await Promise.all(
    EU_TYPES.map(async (type) => {
      const count = await prisma.legalDocument.count({
        where: { content_type: type.contentType },
      })
      return { ...type, count }
    })
  )

  const totalCount = typeCounts.reduce((sum, t) => sum + t.count, 0)

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
            <BreadcrumbPage>EU-lagstiftning</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold">EU-lagstiftning</h1>
        <p className="mt-2 text-muted-foreground">
          Utforska {totalCount.toLocaleString('sv-SE')} EU-rättsakter som gäller
          i Sverige
        </p>
      </header>

      {/* Types grid */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Välj typ</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {typeCounts.map((type) => (
            <Card key={type.slug} className="transition-shadow hover:shadow-md">
              <Link href={`/eu/${type.slug}`}>
                <CardHeader>
                  <CardTitle className="text-lg">{type.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-2 text-sm text-muted-foreground">
                    {type.description}
                  </p>
                  <p className="text-sm font-medium">
                    {type.count.toLocaleString('sv-SE')} dokument
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
