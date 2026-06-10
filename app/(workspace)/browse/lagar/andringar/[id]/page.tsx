import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getCachedAmendment,
  getCachedAmendmentMetadata,
} from '@/lib/cache/cached-queries'
import { AmendmentPageContent } from '@/components/features/amendment'
import { DocumentPageLayout } from '@/components/features/document-page-layout'
import { BreadcrumbOverride } from '@/components/layout/breadcrumb-override'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params
  const amendment = await getCachedAmendmentMetadata(id)

  if (!amendment) {
    return {
      title: 'Ändringsförfattning hittades inte',
    }
  }

  return {
    title: `${amendment.title}`,
    description:
      amendment.summary?.substring(0, 155) ||
      `Läs ${amendment.document_number} på Laglig.se`,
  }
}

export default async function WorkspaceAmendmentPage({ params }: PageProps) {
  const { id: slug } = await params
  const amendment = await getCachedAmendment(slug)

  if (!amendment) {
    notFound()
  }

  return (
    <DocumentPageLayout isWorkspace>
      <BreadcrumbOverride label={amendment.document_number} />
      <AmendmentPageContent amendment={amendment} isWorkspace />
    </DocumentPageLayout>
  )
}
