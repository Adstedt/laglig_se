'use client'

/**
 * Story 14.15b, Task 7: Document detail view in sidebar.
 * Shows document info, law list status if applicable, and navigation link.
 */

import { ExternalLink, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { DocumentDetailData } from '@/lib/ai/chat-detail-context'
import type { ComplianceStatus } from '@prisma/client'

const CONTENT_TYPE_LABELS: Record<string, string> = {
  LAG: 'Lag',
  FORORDNING: 'Förordning',
  DIREKTIV: 'EU-direktiv',
  FORESKRIFT: 'Föreskrift',
  RATTSFALL: 'Rättsfall',
}

const COMPLIANCE_LABELS: Record<ComplianceStatus, string> = {
  EJ_PABORJAD: 'Ej påbörjad',
  PAGAENDE: 'Pågående',
  UPPFYLLD: 'Uppfylld',
  EJ_UPPFYLLD: 'Ej uppfylld',
  EJ_TILLAMPLIG: 'Ej tillämplig',
}

const COMPLIANCE_VARIANT: Record<
  ComplianceStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  EJ_PABORJAD: 'outline',
  PAGAENDE: 'default',
  UPPFYLLD: 'default',
  EJ_UPPFYLLD: 'destructive',
  EJ_TILLAMPLIG: 'secondary',
}

interface DocumentDetailProps {
  data: DocumentDetailData
}

export function DocumentDetail({ data }: DocumentDetailProps) {
  const href = `/lagar/${data.slug}`

  return (
    <div className="space-y-4">
      {/* Document header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <Badge variant="secondary" className="text-[10px]">
            {CONTENT_TYPE_LABELS[data.content_type] ?? data.content_type}
          </Badge>
        </div>
        <p className="text-sm font-medium">{data.title}</p>
        <p className="text-xs text-muted-foreground">{data.document_number}</p>
      </div>

      {/* Summary */}
      {data.summary && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            Beskrivning
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {data.summary}
          </p>
        </div>
      )}

      {/* Law list status */}
      {data.lawListItem && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            I din laglista
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <Badge
              variant={COMPLIANCE_VARIANT[data.lawListItem.complianceStatus]}
            >
              {COMPLIANCE_LABELS[data.lawListItem.complianceStatus]}
            </Badge>
          </div>
          {data.lawListItem.group && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Grupp:</span>
              <span className="text-sm">{data.lawListItem.group.name}</span>
            </div>
          )}
        </div>
      )}

      {/* Navigation link */}
      <Button variant="outline" size="sm" className="gap-1.5" asChild>
        <a href={href} target="_blank" rel="noopener noreferrer">
          Visa dokument
          <ExternalLink className="h-3 w-3" />
        </a>
      </Button>
    </div>
  )
}
