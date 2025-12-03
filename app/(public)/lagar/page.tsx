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

export const metadata: Metadata = {
  title: 'Svenska lagar | Laglig.se',
  description:
    'Utforska Sveriges lagar och författningar. Sök bland tusentals SFS-dokument med full text och ändringshistorik.',
  openGraph: {
    title: 'Svenska lagar | Laglig.se',
    description:
      'Utforska Sveriges lagar och författningar. Sök bland tusentals SFS-dokument.',
    type: 'website',
  },
}

export default async function LawsListingPage() {
  // Get some featured/recent laws
  const recentLaws = await prisma.legalDocument.findMany({
    where: { content_type: ContentType.SFS_LAW },
    orderBy: { publication_date: 'desc' },
    take: 20,
    select: {
      id: true,
      title: true,
      slug: true,
      document_number: true,
      publication_date: true,
      summary: true,
    },
  })

  const totalCount = await prisma.legalDocument.count({
    where: { content_type: ContentType.SFS_LAW },
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
            <BreadcrumbPage>Lagar</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Svenska lagar</h1>
        <p className="mt-2 text-muted-foreground">
          Utforska {totalCount.toLocaleString('sv-SE')} svenska lagar och
          författningar
        </p>
      </header>

      {/* Laws list */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Senaste lagar</h2>
        <div className="space-y-4">
          {recentLaws.map((law) => (
            <Card key={law.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-lg">
                    <Link
                      href={`/lagar/${law.slug}`}
                      className="hover:text-primary hover:underline"
                    >
                      {law.title}
                    </Link>
                  </CardTitle>
                  <Badge variant="secondary" className="shrink-0 font-mono">
                    {law.document_number}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {law.summary && (
                  <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">
                    {law.summary}
                  </p>
                )}
                {law.publication_date && (
                  <p className="text-xs text-muted-foreground">
                    Publicerad:{' '}
                    {new Date(law.publication_date).toLocaleDateString('sv-SE')}
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
