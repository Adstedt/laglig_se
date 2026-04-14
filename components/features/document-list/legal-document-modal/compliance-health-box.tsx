'use client'

/**
 * Story 17.18: Compliance Health Box
 * Right-panel summary widget — surfaces gap signals so the user can act:
 *   - Total linked artifacts (always shown when > 0; not a gap)
 *   - Kravpunkter that require evidence but have none (only shown when > 0)
 */

import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Paperclip, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getLinkedArtifactsForListItem,
  type LinkedArtifactsResult,
} from '@/app/actions/linked-artifacts'
import {
  getRequirementsForListItem,
  type RequirementWithEvidence,
} from '@/app/actions/law-list-item-requirements'

interface ComplianceHealthBoxProps {
  listItemId: string
  onLinkedArtifactsClick: () => void
  onKravpunkterGapClick: () => void
}

export function ComplianceHealthBox({
  listItemId,
  onLinkedArtifactsClick,
  onKravpunkterGapClick,
}: ComplianceHealthBoxProps) {
  const { data: artifactsData } = useSWR<LinkedArtifactsResult>(
    `linked-artifacts:${listItemId}`,
    async () => {
      const result = await getLinkedArtifactsForListItem(listItemId)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta artefakter')
      }
      return result.data
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  )

  const { data: requirements } = useSWR<RequirementWithEvidence[]>(
    `list-item-requirements:${listItemId}`,
    async () => {
      const result = await getRequirementsForListItem(listItemId)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta kravpunkter')
      }
      return result.data
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  )

  const totalArtifacts = artifactsData?.artifacts.length ?? 0
  const kravpunkterMissingBevis =
    requirements?.filter((r) => r.bevisRequired && r.evidence.length === 0)
      .length ?? 0

  const showGapKravpunkter = kravpunkterMissingBevis > 0

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">
          Översikt
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <HealthRow
          icon={<Paperclip className="h-3.5 w-3.5" />}
          label={
            totalArtifacts === 1
              ? '1 länkad fil eller dokument'
              : `${totalArtifacts} länkade filer och dokument`
          }
          tone="neutral"
          onClick={onLinkedArtifactsClick}
        />
        {showGapKravpunkter && (
          <HealthRow
            icon={<AlertCircle className="h-3.5 w-3.5" />}
            label={`${kravpunkterMissingBevis} ${kravpunkterMissingBevis === 1 ? 'kravpunkt saknar bevis' : 'kravpunkter saknar bevis'}`}
            tone="warning"
            onClick={onKravpunkterGapClick}
          />
        )}
      </CardContent>
    </Card>
  )
}

interface HealthRowProps {
  icon: React.ReactNode
  label: string
  tone: 'neutral' | 'warning'
  onClick: () => void
}

function HealthRow({ icon, label, tone, onClick }: HealthRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left',
        'hover:bg-muted/50 transition-colors',
        tone === 'warning'
          ? 'text-amber-700 dark:text-amber-400'
          : 'text-foreground'
      )}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
    </button>
  )
}
