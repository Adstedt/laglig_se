import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { TemplateItemEditor } from '@/components/admin/template-item-editor'
import {
  getAdjacentItems,
  getTemplateItemDetail,
} from '@/lib/admin/template-queries'

export const dynamic = 'force-dynamic'

export default async function TemplateItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>
}) {
  const { id, itemId } = await params
  const item = await getTemplateItemDetail(itemId)

  if (!item || item.template.id !== id) notFound()

  const adjacentItems = await getAdjacentItems(item.section.id, item.position)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/admin/templates/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka till mall
        </Link>
      </div>

      <TemplateItemEditor
        item={{
          id: item.id,
          index: item.index,
          position: item.position,
          compliance_summary: item.compliance_summary,
          expert_commentary: item.expert_commentary,
          content_status: item.content_status,
          source_type: item.source_type,
          regulatory_body: item.regulatory_body,
          last_amendment: item.last_amendment,
          replaces_old_reference: item.replaces_old_reference,
          is_service_company_relevant: item.is_service_company_relevant,
          generated_by: item.generated_by,
          reviewed_by: item.reviewed_by,
          reviewer_name: item.reviewer?.name ?? null,
          reviewed_at: item.reviewed_at?.toISOString() ?? null,
          created_at: item.created_at.toISOString(),
          updated_at: item.updated_at.toISOString(),
          document_title: item.document.title,
          document_number: item.document.document_number,
          document_slug: item.document.slug,
          section_id: item.section.id,
          section_name: item.section.name,
          section_number: item.section.section_number,
          template_id: item.template.id,
          template_name: item.template.name,
        }}
        adjacentItems={{
          previousId: adjacentItems.previousId,
          previousTitle: adjacentItems.previousTitle,
          nextId: adjacentItems.nextId,
          nextTitle: adjacentItems.nextTitle,
        }}
      />
    </div>
  )
}
