import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

async function getDocument(slug: string) {
  return prisma.legalDocument.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      document_number: true,
      slug: true,
      content_type: true,
      full_text: true,
      html_content: true,
      source_url: true,
      status: true,
      metadata: true,
    },
  })
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const doc = await getDocument(slug)

  if (!doc) {
    return { title: 'Föreskrift ej hittad' }
  }

  return {
    title: `${doc.title} - ${doc.document_number}`,
    description: `Myndighetsföreskrift: ${doc.title}`,
  }
}

export default async function ForeskrifterDetailPage({ params }: PageProps) {
  const { slug } = await params
  const doc = await getDocument(slug)

  if (!doc || doc.content_type !== 'AGENCY_REGULATION') {
    notFound()
  }

  const isStub = doc.full_text === null
  const metadata = doc.metadata as Record<string, unknown> | null

  // If full content exists (future - after Epic 9), render it
  if (!isStub && doc.html_content) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Hem</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/rattskallor">Regelverk</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{doc.document_number}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <h1 className="mb-4 text-2xl font-bold">{doc.title}</h1>
        <div
          className="prose dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: doc.html_content }}
        />
      </div>
    )
  }

  // Stub placeholder page
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Hem</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/rattskallor">Regelverk</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{doc.document_number}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card className="mt-4">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-orange-600" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Myndighetsföreskrift
              </p>
              <CardTitle className="text-xl">{doc.title}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{doc.document_number}</Badge>
            {metadata?.regulatoryBody ? (
              <Badge variant="secondary">
                {String(metadata.regulatoryBody)}
              </Badge>
            ) : null}
            {metadata?.sourceType ? (
              <Badge variant="secondary">{String(metadata.sourceType)}</Badge>
            ) : null}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Dokumentet är registrerat men fullständigt innehåll läggs till
              inom kort.
            </p>
          </div>

          {doc.source_url && doc.source_url !== '' && (
            <Button variant="outline" asChild>
              <a
                href={doc.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Besök myndighetens webbplats
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
