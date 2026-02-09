'use client'

import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  approveTemplateItem,
  reviewTemplateItem,
  updateTemplateItemContent,
} from '@/app/actions/admin-templates'
import { ContentStatusBadge } from '@/components/admin/content-status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { TemplateItemContentStatus } from '@prisma/client'

interface TemplateItemEditorData {
  id: string
  index: string
  position: number
  compliance_summary: string | null
  expert_commentary: string | null
  content_status: TemplateItemContentStatus
  source_type: string | null
  regulatory_body: string | null
  last_amendment: string | null
  replaces_old_reference: string | null
  is_service_company_relevant: boolean
  generated_by: string | null
  reviewed_by: string | null
  reviewer_name: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  document_title: string
  document_number: string | null
  document_slug: string
  section_id: string
  section_name: string
  section_number: string
  template_id: string
  template_name: string
}

interface AdjacentItemsData {
  previousId: string | null
  previousTitle: string | null
  nextId: string | null
  nextTitle: string | null
}

interface TemplateItemEditorProps {
  item: TemplateItemEditorData
  adjacentItems: AdjacentItemsData
}

export function TemplateItemEditor({
  item,
  adjacentItems,
}: TemplateItemEditorProps) {
  const [complianceSummary, setComplianceSummary] = useState(
    item.compliance_summary ?? ''
  )
  const [expertCommentary, setExpertCommentary] = useState(
    item.expert_commentary ?? ''
  )
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    startTransition(async () => {
      const data: { compliance_summary?: string; expert_commentary?: string } =
        {}
      if (complianceSummary) data.compliance_summary = complianceSummary
      if (expertCommentary) data.expert_commentary = expertCommentary
      const result = await updateTemplateItemContent(item.id, data)
      if (result.success) {
        toast.success('Innehåll sparat')
      } else {
        toast.error(result.error ?? 'Kunde inte spara')
      }
    })
  }

  const handleReview = () => {
    startTransition(async () => {
      const result = await reviewTemplateItem(item.id)
      if (result.success) {
        toast.success('Markerad som granskad')
      } else {
        toast.error(result.error ?? 'Kunde inte markera som granskad')
      }
    })
  }

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveTemplateItem(item.id)
      if (result.success) {
        toast.success('Godkänd')
      } else {
        toast.error(result.error ?? 'Kunde inte godkänna')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{item.document_title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {item.document_number ?? '—'} · {item.section_name} (
            {item.section_number})
          </p>
        </div>
        <ContentStatusBadge status={item.content_status} />
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <InfoRow label="Mall" value={item.template_name} />
            <InfoRow label="Källa" value={item.source_type ?? '—'} />
            <InfoRow
              label="Regulatoriskt organ"
              value={item.regulatory_body ?? '—'}
            />
            <InfoRow
              label="Senaste ändring"
              value={item.last_amendment ?? '—'}
            />
            <InfoRow
              label="Ersätter"
              value={item.replaces_old_reference ?? '—'}
            />
            <InfoRow
              label="Tjänsteföretagsrelevant"
              value={item.is_service_company_relevant ? 'Ja' : 'Nej'}
            />
            {item.reviewer_name && (
              <InfoRow label="Granskad av" value={item.reviewer_name} />
            )}
            {item.reviewed_at && (
              <InfoRow
                label="Granskad"
                value={format(new Date(item.reviewed_at), 'yyyy-MM-dd HH:mm', {
                  locale: sv,
                })}
              />
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Content Editor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Innehåll</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="compliance-summary">Sammanfattning</Label>
            <Textarea
              id="compliance-summary"
              value={complianceSummary}
              onChange={(e) => setComplianceSummary(e.target.value)}
              placeholder="Skriv sammanfattning av efterlevnadskrav..."
              rows={6}
              maxLength={10000}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              {complianceSummary.length} / 10 000 tecken
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expert-commentary">Expertkommentar</Label>
            <Textarea
              id="expert-commentary"
              value={expertCommentary}
              onChange={(e) => setExpertCommentary(e.target.value)}
              placeholder="Skriv expertkommentar..."
              rows={8}
              maxLength={20000}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              {expertCommentary.length} / 20 000 tecken
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isPending}>
          Spara
        </Button>
        <Button variant="outline" onClick={handleReview} disabled={isPending}>
          Markera som granskad
        </Button>
        <Button
          variant="outline"
          onClick={handleApprove}
          disabled={isPending}
          className="bg-green-50 hover:bg-green-100 text-green-800 border-green-200"
        >
          Godkänn
        </Button>
      </div>

      {/* Prev/Next Navigation */}
      <div className="flex items-center justify-between border-t pt-4">
        {adjacentItems.previousId ? (
          <Link
            href={`/admin/templates/${item.template_id}/items/${adjacentItems.previousId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="max-w-[200px] truncate">
              {adjacentItems.previousTitle}
            </span>
          </Link>
        ) : (
          <div />
        )}
        {adjacentItems.nextId ? (
          <Link
            href={`/admin/templates/${item.template_id}/items/${adjacentItems.nextId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <span className="max-w-[200px] truncate">
              {adjacentItems.nextTitle}
            </span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  )
}
