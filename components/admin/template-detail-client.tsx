'use client'

import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { AlertTriangle } from 'lucide-react'
import type { TemplateItemContentStatus, TemplateStatus } from '@prisma/client'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  archiveTemplate,
  bulkRegenerateTemplateItems,
  bulkReviewTemplateItems,
  publishTemplate,
  submitForReview,
} from '@/app/actions/admin-templates'
import { TemplateContentStatus } from '@/components/admin/template-content-status'
import { TemplateEditForm } from '@/components/admin/template-edit-form'
import { TemplateSections } from '@/components/admin/template-sections'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { canTransitionTo } from '@/lib/admin/template-workflow'

export interface TemplateDetailData {
  id: string
  name: string
  slug: string
  description: string | null
  domain: string
  target_audience: string | null
  status: TemplateStatus
  version: number
  document_count: number
  section_count: number
  primary_regulatory_bodies: string[]
  published_at: string | null
  created_at: string
  updated_at: string
  sections: {
    id: string
    section_number: string
    name: string
    description: string | null
    position: number
    item_count: number
  }[]
}

interface TemplateDetailClientProps {
  template: TemplateDetailData
  contentStatusCounts: Record<string, number>
  regeneratedSincePublishCount?: number | undefined
}

export function TemplateDetailClient({
  template,
  contentStatusCounts,
  regeneratedSincePublishCount,
}: TemplateDetailClientProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const handleSelectionChange = (itemId: string, selected: boolean) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(itemId)
      else next.delete(itemId)
      return next
    })
  }

  const handleBulkReview = () => {
    startTransition(async () => {
      const result = await bulkReviewTemplateItems(template.id)
      if (result.success) {
        toast.success(
          `${result.updatedCount ?? 0} objekt markerade som granskade`
        )
      } else {
        toast.error(result.error ?? 'Kunde inte markera objekt')
      }
    })
  }

  const handleBulkRegenerate = () => {
    startTransition(async () => {
      const result = await bulkRegenerateTemplateItems(template.id, [
        ...selectedItemIds,
      ])
      if (result.success) {
        toast.success(
          `${result.updatedCount ?? 0} objekt markerade för regenerering`
        )
        setSelectedItemIds(new Set())
      } else {
        toast.error(result.error ?? 'Kunde inte regenerera objekt')
      }
    })
  }

  const handleSubmitForReview = () => {
    startTransition(async () => {
      const result = await submitForReview(template.id)
      if (result.success) {
        toast.success('Mall skickad till granskning')
      } else {
        toast.error(result.error ?? 'Kunde inte skicka till granskning')
      }
    })
  }

  const handlePublish = () => {
    startTransition(async () => {
      const result = await publishTemplate(template.id)
      if (result.success) {
        toast.success('Mall publicerad')
      } else {
        toast.error(result.error ?? 'Kunde inte publicera')
      }
    })
  }

  const handleArchive = () => {
    startTransition(async () => {
      const result = await archiveTemplate(template.id)
      if (result.success) {
        toast.success('Mall arkiverad')
      } else {
        toast.error(result.error ?? 'Kunde inte arkivera')
      }
    })
  }

  // Build item content_statuses array for transition validation
  const itemContentStatuses: TemplateItemContentStatus[] = []
  for (const [status, count] of Object.entries(contentStatusCounts)) {
    for (let i = 0; i < count; i++) {
      itemContentStatuses.push(status as TemplateItemContentStatus)
    }
  }

  const aiGeneratedCount = contentStatusCounts['AI_GENERATED'] ?? 0

  return (
    <>
      {/* Workflow Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <WorkflowButtons
          status={template.status}
          itemContentStatuses={itemContentStatuses}
          isPending={isPending}
          onSubmitForReview={handleSubmitForReview}
          onPublish={handlePublish}
          onArchive={handleArchive}
        />

        {aiGeneratedCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkReview}
            disabled={isPending}
          >
            Markera alla AI-genererade som granskade ({aiGeneratedCount})
          </Button>
        )}

        {selectedItemIds.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkRegenerate}
            disabled={isPending}
          >
            Regenerera valda ({selectedItemIds.size})
          </Button>
        )}

        {regeneratedSincePublishCount != null &&
          regeneratedSincePublishCount > 0 && (
            <Badge
              variant="outline"
              className="border-yellow-400 text-yellow-700"
            >
              <AlertTriangle className="mr-1 h-3 w-3" />
              {regeneratedSincePublishCount} objekt åter-genererade sedan
              senaste publicering
            </Badge>
          )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Template Metadata */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Mallinformation</CardTitle>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                Redigera
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <TemplateEditForm
                template={template}
                onCancel={() => setIsEditing(false)}
                onSaved={() => setIsEditing(false)}
              />
            ) : (
              <dl className="space-y-3 text-sm">
                <InfoRow label="Namn" value={template.name} />
                <InfoRow label="Slug" value={template.slug} />
                <InfoRow label="Domän" value={template.domain} />
                <InfoRow
                  label="Beskrivning"
                  value={template.description ?? '—'}
                />
                <InfoRow
                  label="Målgrupp"
                  value={template.target_audience ?? '—'}
                />
                <InfoRow
                  label="Regulatoriska organ"
                  value={
                    template.primary_regulatory_bodies.length > 0
                      ? template.primary_regulatory_bodies.join(', ')
                      : '—'
                  }
                />
                <InfoRow label="Version" value={String(template.version)} />
                <InfoRow
                  label="Skapad"
                  value={format(
                    new Date(template.created_at),
                    'yyyy-MM-dd HH:mm',
                    { locale: sv }
                  )}
                />
                <InfoRow
                  label="Uppdaterad"
                  value={format(
                    new Date(template.updated_at),
                    'yyyy-MM-dd HH:mm',
                    { locale: sv }
                  )}
                />
                {template.published_at && (
                  <InfoRow
                    label="Publicerad"
                    value={format(
                      new Date(template.published_at),
                      'yyyy-MM-dd HH:mm',
                      { locale: sv }
                    )}
                  />
                )}
              </dl>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {template.document_count}
                </div>
                <p className="text-sm text-muted-foreground">Dokument</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {template.section_count}
                </div>
                <p className="text-sm text-muted-foreground">Sektioner</p>
              </CardContent>
            </Card>
          </div>

          {/* Content Status Dashboard */}
          <TemplateContentStatus
            counts={
              contentStatusCounts as Record<TemplateItemContentStatus, number>
            }
          />
        </div>
      </div>

      {/* Sections */}
      <TemplateSections
        templateId={template.id}
        sections={template.sections}
        totalDocs={template.document_count}
        selectedItemIds={selectedItemIds}
        onSelectionChange={handleSelectionChange}
      />
    </>
  )
}

function WorkflowButtons({
  status,
  itemContentStatuses,
  isPending,
  onSubmitForReview,
  onPublish,
  onArchive,
}: {
  status: TemplateStatus
  itemContentStatuses: TemplateItemContentStatus[]
  isPending: boolean
  onSubmitForReview: () => void
  onPublish: () => void
  onArchive: () => void
}) {
  if (status === 'DRAFT') {
    const transition = canTransitionTo(
      'DRAFT',
      'IN_REVIEW',
      itemContentStatuses
    )
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                size="sm"
                onClick={onSubmitForReview}
                disabled={isPending || !transition.allowed}
              >
                Skicka till granskning
              </Button>
            </span>
          </TooltipTrigger>
          {!transition.allowed && (
            <TooltipContent>
              <p>{transition.reason}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (status === 'IN_REVIEW') {
    const transition = canTransitionTo(
      'IN_REVIEW',
      'PUBLISHED',
      itemContentStatuses
    )
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                size="sm"
                onClick={onPublish}
                disabled={isPending || !transition.allowed}
              >
                Publicera
              </Button>
            </span>
          </TooltipTrigger>
          {!transition.allowed && (
            <TooltipContent>
              <p>{transition.reason}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (status === 'PUBLISHED') {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={onArchive}
        disabled={isPending}
      >
        Arkivera
      </Button>
    )
  }

  return null
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right max-w-[60%]">{value}</dd>
    </div>
  )
}
