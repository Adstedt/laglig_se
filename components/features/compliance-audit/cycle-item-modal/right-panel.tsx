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
 *   1. Signera bedömning — bedömning + motivering + Signera (post-21.16 promote)
 *   2. Detaljer — källstatus + ansvarig (reference info)
 *   3. Snabblänkar — Fråga Lexa + lagbok + historik
 *   4. Att uppmärksamma — actionable signals only (bevis gaps, open
 *      findings, last-reviewed timestamp). Replaced the old "Hälsa" box
 *      that duplicated left-panel info. v2 audit-flow alignment 2026-04-25.
 */

import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import useSWR from 'swr'
import { Check, Circle, Clock, ExternalLink, History } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { getStatusBadgeProps } from '@/lib/ui/badge-tones'
import { getLinkedArtifactsForListItem } from '@/app/actions/linked-artifacts'
import { FindingSeverity, FindingType } from '@prisma/client'
import type { CycleItemRow } from '@/app/actions/compliance-audit-item'
import type { FindingRow } from '@/app/actions/compliance-finding'
import type {
  ComplianceCycleStatus,
  EfterlevnadsBedomning,
  WorkspaceRole,
} from '@prisma/client'
import { canSignOffItem } from '@/lib/compliance-audit/authorization-shared'
import { getCycleReadOnlyReason } from '@/components/features/compliance-audit/cycle-copy'

interface CycleItemModalRightPanelProps {
  item: CycleItemRow
  findings: FindingRow[]
  readOnly: boolean
  cycleStatus: ComplianceCycleStatus
  onBedomningChange: (_next: EfterlevnadsBedomning | null) => Promise<void>
  onMotiveringChange: (_next: string | null) => Promise<void>
  onSign: () => Promise<void>
  onUnsign: () => Promise<void>
  /** Per-row sign-off authorization input. Mirrors cycle-items-tab. */
  currentUserId: string
  currentUserRole: WorkspaceRole
  leadAuditorUserId: string
}

export function CycleItemModalRightPanel({
  item,
  findings,
  readOnly,
  cycleStatus,
  onBedomningChange,
  onMotiveringChange,
  onSign,
  onUnsign,
  currentUserId,
  currentUserRole,
  leadAuditorUserId,
}: CycleItemModalRightPanelProps) {
  const shell = useSplitPanelModalOptional()
  const canToggleChat = shell?.hasChat ?? false
  const openChat = shell?.openChat

  const statusOption = COMPLIANCE_STATUS_OPTIONS.find(
    (o) => o.value === item.sourceComplianceStatus
  )

  const hasMotivering =
    item.motivering !== null && item.motivering.trim().length > 0
  const itemReadOnly = readOnly || item.signedOffAt !== null
  const userCanSignOff = canSignOffItem({
    role: currentUserRole,
    userId: currentUserId,
    leadAuditorUserId,
    responsibleUserId: item.sourceResponsibleUser?.id ?? null,
  })
  const canSign =
    !readOnly &&
    item.signedOffAt === null &&
    item.efterlevnadsbedomning !== null &&
    hasMotivering &&
    userCanSignOff
  const canUnsign = !readOnly && item.signedOffAt !== null && userCanSignOff
  const signDisabledReason = readOnly
    ? (getCycleReadOnlyReason(cycleStatus) ?? 'Kontrollen kan inte redigeras')
    : item.efterlevnadsbedomning === null
      ? 'Ange bedömning innan signering'
      : !hasMotivering
        ? 'Skriv en motivering innan signering'
        : !userCanSignOff
          ? 'Endast ansvarig revisor, dokumentets ansvarige eller administratörer kan signera'
          : undefined

  const openCount = findings.filter((f) => f.closedAt === null).length
  const majorCount = findings.filter(
    (f) =>
      f.closedAt === null &&
      f.type === FindingType.AVVIKELSE &&
      f.severity === FindingSeverity.MAJOR
  ).length

  // v2 (2026-04-25): Bevis-gap count for the "Att uppmärksamma" card.
  // Reuses the SAME SWR key + return shape as `KravpunkterSnapshotList` +
  // `LinkedArtifactsPanel` so all three components share one cache + one
  // network round-trip. The return shape MUST be the full
  // `LinkedArtifactsResult` (not just `.artifacts`) — anything narrower
  // corrupts the shared cache and leaves the LinkedArtifactsPanel stuck
  // in loading.
  const { data: linkedArtifactsResult } = useSWR(
    item.lawListItemId ? `linked-artifacts:${item.lawListItemId}` : null,
    async () => {
      const result = await getLinkedArtifactsForListItem(item.lawListItemId)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta bevis')
      }
      return result.data
    },
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  )
  const linkedArtifacts = linkedArtifactsResult?.artifacts
  const bevisGapCount = (item.kravpunkterSnapshot?.requirements ?? []).filter(
    (req) => {
      if (!req.bevis_required) return false
      return !linkedArtifacts?.some((a) =>
        a.requirements.some((r) => r.id === req.id)
      )
    }
  ).length

  return (
    <div className="h-full border-l bg-muted/30 max-md:border-t max-md:border-l-0">
      <ScrollArea className="h-full max-h-[calc(90vh-60px)] max-md:max-h-none">
        <div className="space-y-6 p-6">
          {/* ---------------------- Signera (action card) ---------------------
           *  Top-positioned action card: bedömning + motivering + signera
           *  live together because all three are prerequisites for a signed
           *  audit record. Detaljer below is pure reference info (källstatus,
           *  ansvarig, granskad) that doesn't change during sign-off.
           *
           *  Matches the standard card chrome used across this modal — the
           *  prereq pills + required asterisks are the attention signal, no
           *  tinted border needed (kept visually on-brand with Laglig's
           *  minimal palette). */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base font-semibold text-foreground">
                <span>Signera bedömning</span>
                {!readOnly && item.signedOffAt === null ? (
                  <SignPrereqChecklist
                    hasBedomning={item.efterlevnadsbedomning !== null}
                    hasMotivering={hasMotivering}
                  />
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Bedömning — the audit verdict for this document. */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="cycle-item-bedomning"
                  required={
                    !readOnly &&
                    item.signedOffAt === null &&
                    item.efterlevnadsbedomning === null
                  }
                >
                  Bedömning
                </Label>
                <ItemBedomningSelect
                  value={item.efterlevnadsbedomning}
                  onChange={onBedomningChange}
                  readOnly={itemReadOnly}
                />
              </div>

              {/* Motivering — the why behind the verdict. Required for sign-off
               *  both client + server side (app/actions/compliance-audit-item.ts). */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="cycle-item-motivering"
                  required={
                    !readOnly && item.signedOffAt === null && !hasMotivering
                  }
                >
                  Motivering
                </Label>
                <ItemMotiveringEditor
                  value={item.motivering}
                  onChange={onMotiveringChange}
                  readOnly={itemReadOnly}
                />
              </div>

              {/* Action */}
              {readOnly && item.signedOffAt === null ? (
                <p className="rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {getCycleReadOnlyReason(cycleStatus) ??
                    'Kontrollen kan inte redigeras.'}{' '}
                  Signering är låst.
                </p>
              ) : (
                <ItemSignOffButton
                  signedOffAt={item.signedOffAt}
                  signedOffBy={item.signedOffBy}
                  canSign={canSign}
                  canUnsign={canUnsign}
                  onSign={onSign}
                  onUnsign={onUnsign}
                  disabledReason={signDisabledReason}
                  className="w-full"
                  signedVariant="banner"
                />
              )}
            </CardContent>
          </Card>

          {/* --------------------------- Detaljer ---------------------------
           *  Reference info that doesn't change during sign-off. Bedömning +
           *  motivering moved to the action card above. */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Detaljer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                <DetailRow label="Nuvarande status">
                  {statusOption ? (
                    (() => {
                      const props = getStatusBadgeProps(
                        'compliance-status',
                        statusOption.value
                      )
                      return (
                        <Badge tone={props.tone} variant={props.variant}>
                          {props.label}
                        </Badge>
                      )
                    })()
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </DetailRow>

                <DetailRow label="Ansvarig">
                  <span className="text-sm">
                    {item.sourceResponsibleUser?.name ?? '—'}
                  </span>
                </DetailRow>
                {/* v2 (2026-04-25): "Granskad" timestamp moved to the
                 *  "Att uppmärksamma" card below — it's an audit-progress
                 *  signal, not a static reference field. */}
              </div>
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
                  Fråga assistenten om denna lag
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

          {/* -------------------- Att uppmärksamma --------------------------
           *  v2 (2026-04-25): replaces the old "Hälsa" card which duplicated
           *  the left panel's "N öppna anmärkningar · M kravpunkter" info.
           *  Surfaces ONLY actionable audit signals — hides the entire card
           *  when nothing genuinely needs attention. */}
          {bevisGapCount > 0 || openCount > 0 || item.reviewedAt ? (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-foreground">
                  Att uppmärksamma
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {bevisGapCount > 0 ? (
                  <HealthRow
                    tone="warning"
                    label={
                      bevisGapCount === 1
                        ? 'Bevis saknas för 1 kravpunkt'
                        : `Bevis saknas för ${bevisGapCount} kravpunkter`
                    }
                  />
                ) : null}
                {openCount > 0 ? (
                  <HealthRow
                    tone={majorCount > 0 ? 'critical' : 'warning'}
                    label={
                      openCount === 1
                        ? '1 öppen anmärkning'
                        : `${openCount} öppna anmärkningar`
                    }
                    accent={majorCount > 0 ? `${majorCount} MAJOR` : undefined}
                  />
                ) : null}
                {item.reviewedAt ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-[12.5px]">
                      Senast granskad{' '}
                      {format(item.reviewedAt, 'd MMM yyyy HH:mm', {
                        locale: sv,
                      })}
                    </span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-pieces
// ---------------------------------------------------------------------------

// Form-style label for the sign-action card. `required=true` adds an asterisk
// in the brand accent color to draw attention to blocking prerequisites.
function Label({
  htmlFor,
  required = false,
  children,
}: {
  htmlFor?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground"
      id={htmlFor}
    >
      <span>{children}</span>
      {required ? (
        <span
          aria-label="obligatoriskt"
          className="text-primary"
          title="Obligatoriskt innan signering"
        >
          *
        </span>
      ) : null}
    </div>
  )
}

// Two-step prerequisite checklist shown next to the card title. Gives auditors
// a glanceable signal of what's still blocking sign-off without having to
// hover the button tooltip.
function SignPrereqChecklist({
  hasBedomning,
  hasMotivering,
}: {
  hasBedomning: boolean
  hasMotivering: boolean
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-normal">
      <PrereqPill done={hasBedomning} label="Bedömning" />
      <PrereqPill done={hasMotivering} label="Motivering" />
    </div>
  )
}

function PrereqPill({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5',
        done
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'border-muted-foreground/30 bg-muted/30 text-muted-foreground'
      )}
    >
      {done ? (
        <Check className="h-2.5 w-2.5" />
      ) : (
        <Circle className="h-2.5 w-2.5" />
      )}
      {label}
    </span>
  )
}

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
