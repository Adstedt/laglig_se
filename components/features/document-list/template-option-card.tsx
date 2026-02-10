'use client'

/**
 * Story 12.10b Task 4: Compact template card for the create-list chooser.
 */

import { FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  DOMAIN_LABELS,
  DOMAIN_COLORS,
  DEFAULT_DOMAIN_COLOR,
} from '@/lib/constants/template-domains'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'

interface TemplateOptionCardProps {
  template: PublishedTemplate
  onClick: () => void
}

export function TemplateOptionCard({
  template,
  onClick,
}: TemplateOptionCardProps) {
  const domainLabel = DOMAIN_LABELS[template.domain] ?? template.domain
  const domainColor = DOMAIN_COLORS[template.domain] ?? DEFAULT_DOMAIN_COLOR

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none"
    >
      <Badge
        variant="outline"
        className={`w-fit text-[10px] px-1.5 py-0 ${domainColor}`}
      >
        {domainLabel}
      </Badge>
      <p className="font-medium text-sm leading-tight">{template.name}</p>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <FileText className="h-3 w-3 shrink-0" />
        <span>{template.document_count} lagar</span>
      </div>
      {template.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {template.description}
        </p>
      )}
      {template.variants.length > 0 && (
        <p className="text-xs italic text-muted-foreground">
          Tjänsteföretagsversion tillgänglig
        </p>
      )}
    </div>
  )
}
