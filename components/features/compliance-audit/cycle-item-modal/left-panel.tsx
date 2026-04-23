'use client'

/**
 * Epic 21 Story 21.16 — Cycle Item modal left panel.
 *
 * Visual alignment pass (post-21.16): each section is wrapped in an
 * `AccordionItem` matching `legal-document-modal/left-panel.tsx` — same
 * border + icon-prefixed trigger typography + click-to-collapse behaviour.
 * All sections default to open so auditors see everything at a glance;
 * session state is NOT persisted (unlike the law modal) because the cycle
 * audit flow is a focused review session, not exploratory browsing.
 *
 * Primary content area. Stacks (top to bottom):
 *   1. Law context strip — title, subtitle
 *   2. Findings — severity-first Öppna group + collapsible Stängda
 *   3. Kravpunkter snapshot — frozen at materialisation
 *   4. Hur påverkar detta oss? — live business context (read-only here)
 *   5. Länkade artefakter — reuses LinkedArtifactsPanel (readOnly)
 */

import { useEffect, useMemo, useRef } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  HelpCircle,
  Paperclip,
  Plus,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { LinkedArtifactsPanel } from '@/components/features/document-list/legal-document-modal/linked-artifacts-panel'
import {
  FindingCard,
  compareFindingsBySeverity,
} from '@/components/features/compliance-audit/finding-card'
import { KravpunkterSnapshotList } from '@/components/features/compliance-audit/kravpunkter-snapshot-list'
import { BusinessContextReadOnly } from './business-context-readonly'
import type { CycleItemRow } from '@/app/actions/compliance-audit-item'
import type { FindingRow } from '@/app/actions/compliance-finding'

interface CycleItemModalLeftPanelProps {
  item: CycleItemRow
  findings: FindingRow[]
  focusFindingId: string | null
  readOnly: boolean
  onEditFinding: (_finding: FindingRow) => void
  onAddFinding: () => void
}

const ACCORDION_ITEMS = [
  'findings',
  'kravpunkter',
  'business-context',
  'linked-artifacts',
] as const

export function CycleItemModalLeftPanel({
  item,
  findings,
  focusFindingId,
  readOnly,
  onEditFinding,
  onAddFinding,
}: CycleItemModalLeftPanelProps) {
  const { openFindings, closedFindings } = useMemo(() => {
    const open = findings
      .filter((f) => f.closedAt === null)
      .sort(compareFindingsBySeverity)
    const closed = findings
      .filter((f) => f.closedAt !== null)
      .sort((a, b) => {
        const aTime = a.closedAt?.getTime() ?? 0
        const bTime = b.closedAt?.getTime() ?? 0
        return bTime - aTime
      })
    return { openFindings: open, closedFindings: closed }
  }, [findings])

  // Scroll the focused finding into view on mount + brief highlight via the
  // focused prop. Uses data-testid as the scroll target selector.
  const focusedRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!focusFindingId) return
    const el = document.querySelector<HTMLElement>(
      `[data-testid="finding-card-${focusFindingId}"]`
    )
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [focusFindingId])

  return (
    <div className="space-y-4 overflow-hidden p-6">
      {/* Law context strip */}
      <header className="space-y-1">
        <h2 className="text-xl font-semibold leading-tight text-foreground">
          {item.lawTitle}
        </h2>
        <p className="text-xs text-muted-foreground">
          <span>{item.lawDocumentNumber}</span>
          {' · '}
          <a
            href="/laglistor"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-primary hover:underline"
          >
            Öppna i laglista
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </header>

      <Accordion
        type="multiple"
        defaultValue={[...ACCORDION_ITEMS]}
        className="space-y-2"
      >
        {/* ------- Findings ------- */}
        <AccordionItem
          value="findings"
          className="rounded-lg border border-border/60"
        >
          <AccordionTrigger className="rounded-t-lg px-4 py-3 hover:bg-muted/50 hover:no-underline data-[state=closed]:rounded-lg">
            <div className="flex flex-1 items-center justify-between gap-2 pr-2">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4" />
                <span>Findings</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {openFindings.length} öppna · {closedFindings.length} stängda
                </span>
              </div>
              {!readOnly ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    // Prevent the accordion toggle from firing when the user
                    // clicks the inline add button inside the trigger row.
                    e.stopPropagation()
                    onAddFinding()
                  }}
                  data-testid="modal-add-finding"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Lägg till finding
                </Button>
              ) : null}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div ref={focusedRef}>
              {openFindings.length === 0 && closedFindings.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-sm italic text-muted-foreground">
                  Inga findings för denna post ännu.
                </p>
              ) : null}

              {/* Öppna — always visible, severity-first */}
              {openFindings.length > 0 ? (
                <div className="space-y-2">
                  {openFindings.map((f) => (
                    <FindingCard
                      key={f.id}
                      finding={f}
                      onClick={!readOnly ? () => onEditFinding(f) : undefined}
                      focused={focusFindingId === f.id}
                    />
                  ))}
                </div>
              ) : null}

              {/* Stängda — nested collapsible, deemphasized */}
              {closedFindings.length > 0 ? (
                <details className="group mt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground">
                    <ChevronDown className="h-3 w-3 -rotate-90 transition-transform group-open:rotate-0" />
                    Stängda · {closedFindings.length}
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    {closedFindings.map((f) => (
                      <FindingCard
                        key={f.id}
                        finding={f}
                        onClick={!readOnly ? () => onEditFinding(f) : undefined}
                        focused={focusFindingId === f.id}
                      />
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ------- Kravpunkter ------- */}
        <AccordionItem
          value="kravpunkter"
          className="rounded-lg border border-border/60"
        >
          <AccordionTrigger className="rounded-t-lg px-4 py-3 hover:bg-muted/50 hover:no-underline data-[state=closed]:rounded-lg">
            <div className="flex items-center gap-2 text-base font-semibold text-foreground">
              <ClipboardCheck className="h-4 w-4" />
              <span>Kravpunkter</span>
              <span className="text-xs font-normal text-muted-foreground">
                Snapshot
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <KravpunkterSnapshotList snapshot={item.kravpunkterSnapshot} />
          </AccordionContent>
        </AccordionItem>

        {/* ------- Hur påverkar detta oss? ------- */}
        <AccordionItem
          value="business-context"
          className="rounded-lg border border-border/60"
        >
          <AccordionTrigger className="rounded-t-lg px-4 py-3 hover:bg-muted/50 hover:no-underline data-[state=closed]:rounded-lg">
            <div className="flex items-center gap-2 text-base font-semibold text-foreground">
              <HelpCircle className="h-4 w-4" />
              <span>Hur påverkar detta oss?</span>
              <span className="text-xs font-normal text-muted-foreground">
                Live
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <BusinessContextReadOnly
              content={item.businessContext}
              lawListItemId={item.lawListItemId}
            />
          </AccordionContent>
        </AccordionItem>

        {/* ------- Länkade artefakter ------- */}
        <AccordionItem
          value="linked-artifacts"
          className="rounded-lg border border-border/60"
        >
          <AccordionTrigger className="rounded-t-lg px-4 py-3 hover:bg-muted/50 hover:no-underline data-[state=closed]:rounded-lg">
            <div className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Paperclip className="h-4 w-4" />
              <span>Länkade artefakter</span>
              <span className="text-xs font-normal text-muted-foreground">
                Live
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <p className="mb-3 text-xs text-muted-foreground">
              Visar nuvarande kopplingar till källagen — den försseglade
              bevismängden hanteras separat vid försegling.
            </p>
            {/* Nested accordion panel from legal-document-modal is itself an
                AccordionItem, so it needs its own Accordion ancestor. Keep
                it mounted open by default so users see artefakter without a
                second click. */}
            <Accordion
              type="multiple"
              defaultValue={['linked-artifacts']}
              className="w-full"
            >
              <LinkedArtifactsPanel listItemId={item.lawListItemId} readOnly />
            </Accordion>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
