import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { TemplateDetailClient } from '@/components/admin/template-detail-client'
import { Badge } from '@/components/ui/badge'
import {
  TEMPLATE_STATUS_LABELS,
  TEMPLATE_STATUS_VARIANT,
} from '@/lib/admin/constants'
import { getTemplateDetail } from '@/lib/admin/template-queries'

export const dynamic = 'force-dynamic'

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const template = await getTemplateDetail(id)

  if (!template) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/templates"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </Link>
        <h1 className="text-2xl font-bold">{template.name}</h1>
        <Badge variant={TEMPLATE_STATUS_VARIANT[template.status]}>
          {TEMPLATE_STATUS_LABELS[template.status]}
        </Badge>
        {template.is_variant && (
          <Badge variant="outline" className="text-xs">
            Variant
          </Badge>
        )}
      </div>

      {template.is_variant && template.parent && (
        <p className="text-sm text-muted-foreground">
          Variant av{' '}
          <Link
            href={`/admin/templates/${template.parent.id}`}
            className="underline hover:text-foreground"
          >
            {template.parent.name}
          </Link>
        </p>
      )}

      <TemplateDetailClient
        template={{
          id: template.id,
          name: template.name,
          slug: template.slug,
          description: template.description,
          domain: template.domain,
          target_audience: template.target_audience,
          status: template.status,
          version: template.version,
          document_count: template.document_count,
          section_count: template.section_count,
          primary_regulatory_bodies: template.primary_regulatory_bodies,
          published_at: template.published_at?.toISOString() ?? null,
          created_at: template.created_at.toISOString(),
          updated_at: template.updated_at.toISOString(),
          sections: template.sections.map((s) => ({
            id: s.id,
            section_number: s.section_number,
            name: s.name,
            description: s.description,
            position: s.position,
            item_count: s.item_count,
          })),
        }}
      />
    </div>
  )
}
