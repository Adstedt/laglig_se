'use client'

/**
 * Story 21.9 — Confirmation dialog for cycle Seal (AVSLUTAD → SEALED).
 *
 * Destructive primary — seal is irreversible per architecture §6.4.
 *
 * Open-avvikelse gate (AC 6 — Gate-with-manual-override):
 *  - `openAvvikelser.length > 0` → warning box + the actual avvikelser are
 *    listed with severity + title + (optional) parent-document context, then
 *    a single override textarea (one motivering covers all listed). Primary
 *    disabled until textarea.trim().length >= 20.
 *  - Otherwise textarea omitted; primary enabled immediately.
 *
 * Surfacing the actual avvikelser (rather than just a count) lets the user
 * write a meaningful motivering without context-switching to the Anmärkningar
 * tab to remember what they're overriding. Per-PO design 2026-04-24 (post-
 * smoke-test feedback): one motivation may cover multiple avvikelser, but
 * each avvikelse is individually visible so the user can speak to each.
 *
 * `pendingTasks` approximation (deliberate): count derived client-side from
 * `findings.filter(f => f.correctiveActionTaskId !== null && f.closedAt
 * === null)` — proxies "tasks not yet completed". Accepted inaccuracy per
 * Story 21.6's original design decision; do NOT add a DB round-trip to
 * "fix" it.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { FindingSeverity } from '@prisma/client'

const MIN_OVERRIDE_LENGTH = 20

/**
 * Type-to-confirm phrase. Required on every seal regardless of override
 * status — seal is irreversible (architecture §6.4) and the destructive
 * red button alone is insufficient friction for an audit-grade integrity
 * commit. Pattern: GitHub repo deletion / Stripe API key revocation /
 * Supabase project deletion. Case-sensitive — the deliberate friction is
 * the point.
 */
const CONFIRM_PHRASE = 'FASTSTÄLL'

/**
 * Minimal projection of a FindingRow needed by the dialog. Keeps the prop
 * surface narrow + makes mocking in tests trivial.
 */
export interface OpenAvvikelseSummary {
  id: string
  title: string
  severity: FindingSeverity | null
  /**
   * Short label of the law/document the avvikelse is attached to (if any).
   * Helps the user disambiguate when several avvikelser share a similar
   * title across different lagar. Optional — cycle-level avvikelser
   * (no item link) render without it.
   */
  contextLabel?: string | null
}

/**
 * v0.5 — DRAFT-status styrdokument linked as evidence to the cycle's items.
 * Surfaced in the dialog (snapshot-and-accept-with-override pattern, mirrors
 * the AVVIKELSE override). Server returns this from
 * `getDraftEvidenceDocuments(cycleId)`.
 */
export interface DraftDocumentSummary {
  id: string
  title: string
  contextLabel: string | null
}

interface SealCycleDialogProps {
  open: boolean
  onOpenChange: (_next: boolean) => void
  onConfirm: (_overrideReason?: string) => void | Promise<void>
  isSubmitting: boolean
  /**
   * The actual open AVVIKELSE findings on this cycle (length > 0 triggers
   * the override gate). Caller is expected to pre-filter to type=AVVIKELSE
   * + closed_at=null in CycleDetailPage; this component does NOT re-filter.
   */
  openAvvikelser: OpenAvvikelseSummary[]
  /**
   * v0.5 — DRAFT-status styrdokument in the cycle's evidence scope.
   * Length > 0 triggers the override gate (combined with openAvvikelser).
   * One override motivering covers BOTH categories.
   */
  draftDocuments: DraftDocumentSummary[]
  pendingTasks: number
}

export function SealCycleDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
  openAvvikelser,
  draftDocuments,
  pendingTasks,
}: SealCycleDialogProps) {
  const hasAvvikelser = openAvvikelser.length > 0
  const hasDrafts = draftDocuments.length > 0
  const overrideRequired = hasAvvikelser || hasDrafts
  const [overrideReason, setOverrideReason] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const confirmInputRef = useRef<HTMLInputElement | null>(null)

  // Reset both fields when the dialog transitions closed → open so a prior
  // cancelled attempt doesn't leave stale text.
  useEffect(() => {
    if (open) {
      setOverrideReason('')
      setConfirmText('')
    }
  }, [open])

  // No-override case: nothing else competes for focus, so put the cursor in
  // the confirm input. Override case: the override textarea autofocuses
  // first (its own useEffect inside the panel) — user types motivering, then
  // tabs/clicks down to the confirm input.
  useEffect(() => {
    if (!open || overrideRequired) return undefined
    // Wait one tick so Radix has finished its open-animation focus dance.
    const t = window.setTimeout(() => confirmInputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open, overrideRequired])

  const trimmedLen = overrideReason.trim().length
  const overrideMet = !overrideRequired || trimmedLen >= MIN_OVERRIDE_LENGTH
  const confirmMatches = confirmText === CONFIRM_PHRASE
  const primaryDisabled = isSubmitting || !overrideMet || !confirmMatches

  const handleConfirm = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent AlertDialog's default close-on-action so the dialog stays open
    // on error (caller closes explicitly on success).
    e.preventDefault()
    if (overrideRequired) {
      void onConfirm(overrideReason.trim())
    } else {
      void onConfirm(undefined)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Fastställ kontrollen?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Denna åtgärd kan inte ångras. Kontrollen får en unik
                kontrollsumma som visas på revisionsrapporten och gör det
                möjligt för revisor eller certifieringsorgan att senare
                verifiera att innehållet är oförändrat.
              </p>
              <p>
                Efter fastställande är alla dokument, motiveringar och
                anmärkningar låsta mot redigering. För att rätta ett fel måste
                en ny kontroll skapas med samma omfattning.
              </p>
              <p>
                Bevisfiler som används i denna kontroll skyddas mot oavsiktlig
                radering — du får ett varningsmeddelande om någon försöker ta
                bort dem.
              </p>
              {hasAvvikelser ? (
                <OpenAvvikelserOverridePanel
                  openAvvikelser={openAvvikelser}
                  pendingTasks={pendingTasks}
                />
              ) : null}
              {hasDrafts ? (
                <DraftDocumentsOverridePanel draftDocuments={draftDocuments} />
              ) : null}
              {overrideRequired ? (
                <OverrideMotiveringTextarea
                  hasAvvikelser={hasAvvikelser}
                  hasDrafts={hasDrafts}
                  avvikelserCount={openAvvikelser.length}
                  draftsCount={draftDocuments.length}
                  overrideReason={overrideReason}
                  onOverrideReasonChange={setOverrideReason}
                  isSubmitting={isSubmitting}
                  trimmedLen={trimmedLen}
                />
              ) : null}

              {/* Type-to-confirm gate — final friction before the irreversible
                  commit. Always required (override or not). Standard pattern
                  for irreversible destructive ops. */}
              <div className="space-y-1.5 border-t border-border pt-3">
                <label
                  htmlFor="seal-confirm-text"
                  className="block text-xs font-medium text-foreground"
                >
                  Skriv{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
                    {CONFIRM_PHRASE}
                  </code>{' '}
                  för att bekräfta
                </label>
                <Input
                  id="seal-confirm-text"
                  ref={confirmInputRef}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={isSubmitting}
                  placeholder={CONFIRM_PHRASE}
                  autoComplete="off"
                  spellCheck={false}
                  // Only mark invalid when user has typed AND it's wrong —
                  // empty isn't an "error", just incomplete.
                  aria-invalid={confirmText.length > 0 && !confirmMatches}
                  className="font-mono"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={primaryDisabled}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting ? (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            Fastställ kontroll
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ---------------------------------------------------------------------------
// Open-avvikelser panel — surfaced list (no textarea; shared with drafts below)
// ---------------------------------------------------------------------------

interface OpenAvvikelserOverridePanelProps {
  openAvvikelser: OpenAvvikelseSummary[]
  pendingTasks: number
}

function OpenAvvikelserOverridePanel({
  openAvvikelser,
  pendingTasks,
}: OpenAvvikelserOverridePanelProps) {
  const count = openAvvikelser.length
  const taskClause =
    pendingTasks > 0 ? ` med ${pendingTasks} pågående åtgärdsuppgifter` : ''

  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-950/30"
    >
      <p className="font-medium text-amber-900 dark:text-amber-100">
        {count === 1
          ? `Du har 1 öppen avvikelse${taskClause}:`
          : `Du har ${count} öppna avvikelser${taskClause}:`}
      </p>

      <ul className="space-y-1.5">
        {openAvvikelser.map((avv) => (
          <li
            key={avv.id}
            className="flex items-start gap-2 text-amber-950 dark:text-amber-100"
          >
            <SeverityBadge severity={avv.severity} />
            <span className="flex-1 leading-snug">
              {avv.title}
              {avv.contextLabel ? (
                <span className="ml-1 text-amber-800/80 dark:text-amber-200/70">
                  · {avv.contextLabel}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DRAFT styrdokument panel — surfaced list (v0.5)
// ---------------------------------------------------------------------------

interface DraftDocumentsOverridePanelProps {
  draftDocuments: DraftDocumentSummary[]
}

function DraftDocumentsOverridePanel({
  draftDocuments,
}: DraftDocumentsOverridePanelProps) {
  const count = draftDocuments.length
  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-950/30"
    >
      <p className="font-medium text-amber-900 dark:text-amber-100">
        {count === 1
          ? 'Du har 1 styrdokument i utkast-status:'
          : `Du har ${count} styrdokument i utkast-status:`}
      </p>

      <ul className="space-y-1.5">
        {draftDocuments.map((doc) => (
          <li
            key={doc.id}
            className="flex items-start gap-2 text-amber-950 dark:text-amber-100"
          >
            <DraftBadge />
            <span className="flex-1 leading-snug">
              {doc.title}
              {doc.contextLabel ? (
                <span className="ml-1 text-amber-800/80 dark:text-amber-200/70">
                  · {doc.contextLabel}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-amber-800/90 dark:text-amber-200/80">
        Utkast-styrdokument hashas vid fastställande, men deras innehåll kan
        ändras senare via autospar — vilket gör efterföljande verifiering
        opålitlig. Genom att fastställa intygar du att detta är acceptabelt.
      </p>
    </div>
  )
}

function DraftBadge() {
  return (
    <span
      className="mt-0.5 inline-flex shrink-0 items-center rounded border bg-amber-100 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-100 dark:border-amber-700/60"
      aria-label="Status: utkast"
    >
      UTKAST
    </span>
  )
}

// ---------------------------------------------------------------------------
// Override motivering textarea — shared between avvikelser + drafts
// ---------------------------------------------------------------------------

interface OverrideMotiveringTextareaProps {
  hasAvvikelser: boolean
  hasDrafts: boolean
  avvikelserCount: number
  draftsCount: number
  overrideReason: string
  onOverrideReasonChange: (_next: string) => void
  isSubmitting: boolean
  trimmedLen: number
}

function OverrideMotiveringTextarea({
  hasAvvikelser,
  hasDrafts,
  avvikelserCount,
  draftsCount,
  overrideReason,
  onOverrideReasonChange,
  isSubmitting,
  trimmedLen,
}: OverrideMotiveringTextareaProps) {
  const meetsThreshold = trimmedLen >= MIN_OVERRIDE_LENGTH

  // Auto-focus the textarea on mount so the user can type immediately.
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Label adapts based on what's blocking AND the count (singular vs plural
  // Swedish grammar matters — "öppen avvikelse" vs "öppna avvikelser",
  // "ett utkast-styrdokument" vs "utkast-styrdokument").
  const avvPart = avvikelserCount === 1 ? 'öppen avvikelse' : 'öppna avvikelser'
  const draftPart =
    draftsCount === 1 ? 'ett utkast-styrdokument' : 'utkast-styrdokument'
  const label =
    hasAvvikelser && hasDrafts
      ? `Gemensam motivering för fastställande trots ${avvPart} och ${draftPart} (obligatoriskt)`
      : hasAvvikelser
        ? `Motivering för fastställande trots ${avvPart} (obligatoriskt)`
        : `Motivering för fastställande trots ${draftPart} (obligatoriskt)`

  return (
    <div className="space-y-1.5">
      <label
        htmlFor="seal-override-reason"
        className="block text-xs font-medium text-foreground"
      >
        {label}
      </label>
      <Textarea
        id="seal-override-reason"
        ref={textareaRef}
        value={overrideReason}
        onChange={(e) => onOverrideReasonChange(e.target.value)}
        disabled={isSubmitting}
        rows={3}
        maxLength={1000}
        spellCheck={false}
        placeholder="T.ex. Åtgärdsplan beslutad i KMA-möte 2026-04-20. Leverans planerad till Q3 efter brandskyddsutbildning."
        // Only mark invalid when there's genuine input below threshold.
        // Untouched (length 0) shouldn't render as an error state.
        aria-invalid={trimmedLen > 0 && !meetsThreshold}
        className="bg-white dark:bg-background/40 dark:placeholder:text-muted-foreground/60"
      />
      {/* Live counter — single-line, right-aligned, secondary visual weight.
          Below threshold: amber countdown. At/above: emerald confirmation
          that drops the / N denominator (no longer relevant once passed). */}
      <div
        className={cn(
          'flex items-center justify-end gap-1 text-[11px] tabular-nums whitespace-nowrap',
          meetsThreshold
            ? 'text-emerald-700 dark:text-emerald-400'
            : 'text-muted-foreground'
        )}
        aria-live="polite"
      >
        {meetsThreshold ? (
          <>
            <Check className="h-3 w-3" aria-hidden="true" />
            <span>Tillräckligt långt ({trimmedLen} tecken)</span>
          </>
        ) : (
          <span>
            {trimmedLen} / {MIN_OVERRIDE_LENGTH} tecken
          </span>
        )}
      </div>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: FindingSeverity | null }) {
  // MAJOR = stronger red emphasis; MINOR = neutral amber; null defensively
  // renders a generic dot. Inline because we don't want to pull in a full
  // shadcn Badge import for one tiny inline pill. Dark-mode tones drop
  // saturation + invert to softer surfaces against the dark dialog.
  const tone =
    severity === 'MAJOR'
      ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-200 dark:border-red-800/60'
      : severity === 'MINOR'
        ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-100 dark:border-amber-700/60'
        : 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800/60 dark:text-gray-200 dark:border-gray-600/60'

  const label =
    severity === 'MAJOR' ? 'MAJOR' : severity === 'MINOR' ? 'MINOR' : '—'

  return (
    <span
      className={cn(
        'mt-0.5 inline-flex shrink-0 items-center rounded border px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide',
        tone
      )}
      aria-label={`Severitet: ${label}`}
    >
      {label}
    </span>
  )
}
