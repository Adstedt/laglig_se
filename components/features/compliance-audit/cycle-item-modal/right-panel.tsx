'use client'

/**
 * Epic 21 Story 21.16 — Cycle Item modal right panel.
 *
 * Visual alignment pass (post-21.16): mirror `legal-document-modal/right-panel.tsx`'s
 * Card-based layout so the two modals feel like the same product. Previous
 * iteration used bare `<section>` blocks with uppercase tracking-wider
 * headings; switched to `<Card>` + `<CardHeader>` + `<CardTitle>` matching
 * the details-box / quick-links-box / compliance-health-box precedents.
 *
 * Stack order (top to bottom):
 *   1. Detaljer — bedömning, källstatus, ansvarig, granskad + Signera button
 *   2. Motivering — inline editor
 *   3. Snabblänkar — Fråga Lexa + lagbok + historik
 *   4. Hälsa — compact health chips (findings, kravpunkter)
 */

import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { ExternalLink, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { LexaIcon } from '@/components/ui/lexa-icon'
import { useSplitPanelModalOptional } from '@/components/shared/split-panel-modal/context'
import {
  ItemBedomningSelect,
  ItemMotiveringEditor,
  ItemSignOffButton,
} from '@/components/features/compliance-audit/item-bedomning-editor'
import { COMPLIANCE_STATUS_OPTIONS } from '@/components/features/document-list/table-cell-editors/compliance-status-editor'
import { FindingSeverity, FindingType } from '@prisma/client'
import type { CycleItemRow } from '@/app/actions/compliance-audit-item'
import type { FindingRow } from '@/app/actions/compliance-finding'
import type { EfterlevnadsBedomning } from '@prisma/client'

interface CycleItemModalRightPanelProps {
  item: CycleItemRow
  findings: FindingRow[]
  readOnly: boolean
  onBedomningChange: (_next: EfterlevnadsBedomning | null) => Promise<void>
  onMotiveringChange: (_next: string | null) => Promise<void>
  onSign: () => Promise<void>
  onUnsign: () => Promise<void>
}

export function CycleItemModalRightPanel({
  item,
  findings,
  readOnly,
  onBedomningChange,
  onMotiveringChange,
  onSign,
  onUnsign,
}: CycleItemModalRightPanelProps) {
  const shell = useSplitPanelModalOptional()
  const canToggleChat = shell?.hasChat ?? false
  const openChat = shell?.openChat

  const statusOption = COMPLIANCE_STATUS_OPTIONS.find(
    (o) => o.value === item.sourceComplianceStatus
  )

  const canSign =
    !readOnly &&
    item.signedOffAt === null &&
    item.efterlevnadsbedomning !== null
  const canUnsign = !readOnly && item.signedOffAt !== null
  const signDisabledReason = readOnly
    ? 'Kontrollen är fastställd'
    : item.efterlevnadsbedomning === null
      ? 'Ange bedömning innan signering'
      : undefined

  const openCount = findings.filter((f) => f.closedAt === null).length
  const majorCount = findings.filter(
    (f) =>
      f.closedAt === null &&
      f.type === FindingType.AVVIKELSE &&
      f.severity === FindingSeverity.MAJOR
  ).length
  const kravpunkterCount = item.kravpunkterSnapshot?.requirements.length ?? 0

  return (
    <div className="h-full border-l bg-muted/30 max-md:border-t max-md:border-l-0">
      <ScrollArea className="h-full max-h-[calc(90vh-60px)] max-md:max-h-none">
        <div className="space-y-6 p-6">
          {/* --------------------------- Detaljer --------------------------- */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Detaljer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                <DetailRow label="Bedömning">
                  <ItemBedomningSelect
                    value={item.efterlevnadsbedomning}
                    onChange={onBedomningChange}
                    readOnly={readOnly}
                  />
                </DetailRow>

                <DetailRow label="Källstatus">
                  {statusOption ? (
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                        statusOption.color,
                        statusOption.strikethrough && 'line-through'
                      )}
                    >
                      {statusOption.label}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </DetailRow>

                <DetailRow label="Ansvarig">
                  <span className="text-sm">
                    {item.sourceResponsibleUser?.name ?? '—'}
                  </span>
                </DetailRow>

                <DetailRow label="Granskad">
                  <span className="text-xs text-muted-foreground">
                    {item.reviewedAt
                      ? format(item.reviewedAt, 'd MMM yyyy HH:mm', {
                          locale: sv,
                        })
                      : '—'}
                  </span>
                </DetailRow>
              </div>

              {/* Signera — primary action at the bottom of Detaljer */}
              {readOnly && item.signedOffAt === null ? null : (
                <div className="mt-4">
                  <ItemSignOffButton
                    signedOffAt={item.signedOffAt}
                    signedOffBy={item.signedOffBy}
                    canSign={canSign}
                    canUnsign={canUnsign}
                    onSign={onSign}
                    onUnsign={onUnsign}
                    disabledReason={signDisabledReason}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* -------------------------- Motivering -------------------------- */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Motivering
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ItemMotiveringEditor
                value={item.motivering}
                onChange={onMotiveringChange}
                readOnly={readOnly}
              />
            </CardContent>
          </Card>

          {/* ------------------------- Snabblänkar ------------------------- */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Snabblänkar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {canToggleChat && openChat ? (
                <Button
                  type="button"
                  onClick={openChat}
                  className="w-full justify-start gap-2 bg-foreground text-background hover:bg-foreground/90"
                  data-testid="modal-open-chat"
                >
                  <LexaIcon size={16} className="invert-0 dark:invert" />
                  Fråga Lexa om denna lag
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => window.open('/laglistor', '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                Öppna i laglista
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                disabled
                title="Historik kommer i Story 21.13"
              >
                <History className="h-4 w-4" />
                Visa historik
              </Button>
            </CardContent>
          </Card>

          {/* ---------------------------- Hälsa ---------------------------- */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Hälsa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <HealthRow
                tone={
                  majorCount > 0
                    ? 'critical'
                    : openCount > 0
                      ? 'warning'
                      : 'neutral'
                }
                label={
                  openCount === 1
                    ? '1 öppen anmärkning'
                    : `${openCount} öppna anmärkningar`
                }
                accent={majorCount > 0 ? `${majorCount} MAJOR` : undefined}
              />
              <HealthRow
                tone="neutral"
                label={`${kravpunkterCount} kravpunkt${kravpunkterCount === 1 ? '' : 'er'}`}
                accent="snapshot"
              />
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-pieces
// ---------------------------------------------------------------------------

// Mirrors `DetailRow` in legal-document-modal/details-box.tsx for visual
// consistency across both modals.
function DetailRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-2.5 -mx-2 px-2 rounded-md">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center">{children}</div>
    </div>
  )
}

function HealthRow({
  tone,
  label,
  accent,
}: {
  tone: 'critical' | 'warning' | 'neutral'
  label: string
  accent?: string | undefined
}) {
  const toneClass =
    tone === 'critical'
      ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
        : 'border-border bg-card text-foreground'
  const dotClass =
    tone === 'critical'
      ? 'bg-red-500'
      : tone === 'warning'
        ? 'bg-amber-500'
        : 'bg-muted-foreground/40'
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm',
        toneClass
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotClass)} />
        <span className="text-[12.5px]">{label}</span>
      </div>
      {accent ? (
        <span className="text-[10px] uppercase tracking-wide opacity-70">
          {accent}
        </span>
      ) : null}
    </div>
  )
}
