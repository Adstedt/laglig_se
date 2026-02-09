'use client'

import { FileText, Layers, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale/sv'
import { Badge } from '@/components/ui/badge'
import {
  DOMAIN_LABELS,
  DOMAIN_COLORS,
  DEFAULT_DOMAIN_COLOR,
} from '@/lib/constants/template-domains'
import type { TemplateDetail } from '@/lib/db/queries/template-catalog'

interface TemplateDetailHeaderProps {
  template: TemplateDetail
}

export function TemplateDetailHeader({ template }: TemplateDetailHeaderProps) {
  const domainLabel = DOMAIN_LABELS[template.domain] ?? template.domain
  const domainColor = DOMAIN_COLORS[template.domain] ?? DEFAULT_DOMAIN_COLOR
  const formattedDate = format(new Date(template.updated_at), 'd MMM yyyy', {
    locale: sv,
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{template.name}</h1>

      {template.description && (
        <p className="text-muted-foreground">{template.description}</p>
      )}

      {/* Badge row */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={`text-xs py-0 px-1.5 ${domainColor}`}
        >
          {domainLabel}
        </Badge>
        {template.target_audience && (
          <Badge variant="outline" className="text-xs py-0 px-1.5">
            {template.target_audience}
          </Badge>
        )}
        {template.primary_regulatory_bodies.map((body) => (
          <Badge key={body} variant="secondary" className="text-xs py-0 px-1.5">
            {body}
          </Badge>
        ))}
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/50 px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          {template.document_count} lagar
        </span>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Layers className="h-4 w-4" />
          {template.section_count} kategorier
        </span>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          Uppdaterad {formattedDate}
        </span>
      </div>
    </div>
  )
}
