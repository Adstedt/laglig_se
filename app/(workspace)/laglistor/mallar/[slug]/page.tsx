/**
 * Story 12.9: Template Detail & Preview Page
 * Authenticated route: /laglistor/mallar/{slug}
 */

import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublishedTemplateBySlug } from '@/lib/db/queries/template-catalog'
import { TemplateDetailClient } from '@/components/features/templates/template-detail-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const template = await getPublishedTemplateBySlug(slug)
  if (!template) return { title: 'Mall ej hittad | Laglig' }
  return {
    title: `${template.name} | Laglig`,
    description: template.description ?? undefined,
  }
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const template = await getPublishedTemplateBySlug(slug)
  if (!template) notFound()
  return <TemplateDetailClient template={template} />
}
