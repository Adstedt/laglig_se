'use client'

import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import type { TemplateStatus } from '@prisma/client'
import { useState } from 'react'

import { TemplateEditForm } from '@/components/admin/template-edit-form'
import { TemplateSections } from '@/components/admin/template-sections'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
}

export function TemplateDetailClient({ template }: TemplateDetailClientProps) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <>
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
        </div>
      </div>

      {/* Sections */}
      <TemplateSections
        templateId={template.id}
        sections={template.sections}
        totalDocs={template.document_count}
      />
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right max-w-[60%]">{value}</dd>
    </div>
  )
}
