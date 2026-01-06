import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getCachedAmendment,
  getCachedAmendmentMetadata,
} from '@/lib/cache/cached-queries'
import { AmendmentPageContent } from '@/components/features/amendment'

interface PageProps {
  params: Promise<{ id: string }>
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params
  const amendment = await getCachedAmendmentMetadata(id)

  if (!amendment) {
    return {
      title: 'Ändringsförfattning hittades inte | Laglig.se',
    }
  }

  return {
    title: `${amendment.title} | Laglig.se`,
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

  return <AmendmentPageContent amendment={amendment} isWorkspace />
}
