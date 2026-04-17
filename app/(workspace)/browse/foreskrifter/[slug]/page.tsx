import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ExternalLink, FileDown } from 'lucide-react'
import { BackToTopButton } from '@/app/(public)/lagar/[id]/toc-client'
import { DocumentContent } from '@/components/features/document-content'
import { DocumentHero } from '@/components/features/document-hero'
import { DocumentPageLayout } from '@/components/features/document-page-layout'
import { BreadcrumbOverride } from '@/components/layout/breadcrumb-override'
import { AddToLawListButton } from '@/components/features/documents/add-to-law-list-button'
import { getListsContainingDocument } from '@/app/actions/document-list'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { hasPermission } from '@/lib/auth/permissions'

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

export default async function WorkspaceForeskriftPage({ params }: PageProps) {
  const { slug } = await params
  const doc = await getDocument(slug)

  if (!doc || doc.content_type !== 'AGENCY_REGULATION') {
    notFound()
  }

  const isStub = doc.full_text === null
  const metadata = doc.metadata as Record<string, unknown> | null
  const pdfUrl = metadata?.pdfUrl ? String(metadata.pdfUrl) : null

  const extraBadges = metadata?.regulatoryBody ? (
    <Badge variant="outline" className="text-xs">
      {String(metadata.regulatoryBody)}
    </Badge>
  ) : null

  const actionLinks = [
    ...(doc.source_url
      ? [{ href: doc.source_url, label: 'Källa', icon: ExternalLink }]
      : []),
    ...(pdfUrl ? [{ href: pdfUrl, label: 'PDF', icon: FileDown }] : []),
  ]

  const ctx = await getWorkspaceContext()
  const canAddToList = hasPermission(ctx.role, 'documents:add')
  const listIdsContaining = canAddToList
    ? ((await getListsContainingDocument(doc.id)).data ?? [])
    : []

  return (
    <DocumentPageLayout isWorkspace>
      <BreadcrumbOverride label={doc.document_number} />

      <DocumentHero
        title={doc.title}
        documentNumber={doc.document_number}
        contentType="AGENCY_REGULATION"
        status={
          doc.status === 'ACTIVE'
            ? { kind: 'active' }
            : doc.status === 'REPEALED'
              ? { kind: 'repealed' }
              : undefined
        }
        extraBadges={extraBadges}
        actionLinks={actionLinks}
        actions={
          canAddToList ? (
            <AddToLawListButton
              documentId={doc.id}
              initialListIdsContaining={listIdsContaining}
            />
          ) : undefined
        }
      />

      {/* External PDF stub — link directly to the source PDF */}
      {isStub &&
        metadata?.method === 'stub-external-pdf' &&
        !!metadata?.pdfUrl && (
          <Card>
            <CardContent className="p-6 text-center">
              <a
                href={String(metadata.pdfUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium transition-colors hover:bg-accent text-teal-700 dark:text-teal-400"
              >
                <ExternalLink className="h-4 w-4" />
                Öppna originaldokument (PDF)
              </a>
            </CardContent>
          </Card>
        )}

      {/* Generic stub notice */}
      {isStub &&
        !(metadata?.method === 'stub-external-pdf' && metadata?.pdfUrl) && (
          <Card>
            <CardContent className="p-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Dokumentet är registrerat men fullständigt innehåll läggs till
                  inom kort.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Full content */}
      {!isStub && doc.html_content && (
        <DocumentContent
          htmlContent={doc.html_content}
          isWorkspace
          className="rounded-lg bg-card p-6 md:p-10"
        />
      )}

      <BackToTopButton />
    </DocumentPageLayout>
  )
}
