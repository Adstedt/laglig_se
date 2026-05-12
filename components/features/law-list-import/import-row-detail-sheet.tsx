'use client'

/**
 * Story 24.4 follow-up: side drawer surfaced when the user clicks an import
 * row. Owns the "expensive" surface: full source-row metadata, LLM reasoning,
 * alt-candidate picker, and the "Begär tillägg" note dialog. Keeping it out
 * of the table itself lets the table stay dense.
 */

import { useEffect, useState, useTransition } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  SearchX,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  acceptRow,
  rejectRow,
  replaceRowMatch,
  requestCatalogAdd,
  undoRowDecision,
  type ImportRowSummary,
} from '@/app/actions/law-list-import'
import { getContentTypeLabel, getDocumentUrl } from '@/lib/utils/content-type'
import type { ContentType } from '@prisma/client'

interface ImportRowDetailSheetProps {
  row: ImportRowSummary | null
  /** True when the import isn't AWAITING_REVIEW — disables actions. */
  readOnly: boolean
  open: boolean
  onOpenChange: (_open: boolean) => void
  /** Called after any mutation so the parent SWR cache refetches. */
  onMutated: () => void
}

const DECIDED_STATES: ImportRowSummary['match_status'][] = [
  'ACCEPTED_BY_USER',
  'REPLACED_BY_USER',
  'REJECTED_BY_USER',
  'CATALOG_REQUEST_PENDING',
  'CATALOG_REQUEST_FULFILLED',
]

export function ImportRowDetailSheet({
  row,
  readOnly,
  open,
  onOpenChange,
  onMutated,
}: ImportRowDetailSheetProps) {
  const [isPending, startTransition] = useTransition()
  const [showSourceDetails, setShowSourceDetails] = useState(false)
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false)
  const [catalogNote, setCatalogNote] = useState('')
  // Stage-and-confirm: clicking an alt candidate selects it locally but does
  // NOT mutate the row. The staged id is committed when the user clicks
  // "Acceptera". Reset whenever the sheet shows a different row or closes.
  const [stagedCandidateId, setStagedCandidateId] = useState<string | null>(
    null
  )

  useEffect(() => {
    setStagedCandidateId(null)
  }, [row?.id, open])

  if (!row) return null

  const decided = DECIDED_STATES.includes(row.match_status)
  const otherCandidates = row.match_candidates.filter(
    (c) => c.document_id !== row.matched_document_id
  )
  const hasStaging = stagedCandidateId !== null

  function runMutation(
    fn: () => Promise<{ success: boolean; error?: string }>,
    errorTitle: string,
    closeSheet: boolean = true
  ) {
    startTransition(async () => {
      const result = await fn()
      if (!result.success) {
        toast.error(errorTitle, { description: result.error })
        return
      }
      onMutated()
      if (closeSheet) onOpenChange(false)
    })
  }

  function handleAccept() {
    if (!row) return
    if (stagedCandidateId) {
      runMutation(
        () => replaceRowMatch(row.id, stagedCandidateId),
        'Kunde inte byta matchning'
      )
      return
    }
    runMutation(() => acceptRow(row.id), 'Kunde inte acceptera raden')
  }
  function handleReject() {
    if (!row) return
    runMutation(() => rejectRow(row.id), 'Kunde inte avvisa raden')
  }
  function handleUndo() {
    if (!row) return
    runMutation(
      () => undoRowDecision(row.id),
      'Kunde inte ångra beslutet',
      false
    )
  }
  function handleCatalogRequest() {
    if (!row) return
    const note = catalogNote.trim()
    setCatalogDialogOpen(false)
    setCatalogNote('')
    runMutation(
      () => requestCatalogAdd(row.id, note.length > 0 ? note : undefined),
      'Kunde inte begära katalogtillägg'
    )
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 sm:max-w-xl"
        >
          <SheetHeader className="space-y-1 text-left">
            <SheetTitle className="text-base">
              {row.source_titel ?? 'Källrad'}
            </SheetTitle>
            {row.source_sfs_nummer && (
              <SheetDescription className="text-xs">
                {row.source_sfs_nummer}
              </SheetDescription>
            )}
          </SheetHeader>

          <div className="-mx-6 mt-4 flex-1 space-y-6 overflow-y-auto px-6 pb-6">
            {/* Source-row originalrad */}
            {(row.source_omrade ||
              row.source_lagansvarig ||
              row.source_kommentar) && (
              <section>
                <button
                  type="button"
                  onClick={() => setShowSourceDetails((v) => !v)}
                  className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  Originalrad
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${showSourceDetails ? 'rotate-180' : ''}`}
                  />
                </button>
                {showSourceDetails && (
                  <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {row.source_omrade && (
                      <div>
                        <dt className="inline font-medium">Område: </dt>
                        <dd className="inline">{row.source_omrade}</dd>
                      </div>
                    )}
                    {row.source_lagansvarig && (
                      <div>
                        <dt className="inline font-medium">Lagansvarig: </dt>
                        <dd className="inline">{row.source_lagansvarig}</dd>
                      </div>
                    )}
                    {row.source_kommentar && (
                      <div>
                        <dt className="inline font-medium">Kommentar: </dt>
                        <dd className="inline">{row.source_kommentar}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </section>
            )}

            {/* Status — UNMATCHED rows lead with a prominent banner so the
                user understands the situation before scanning candidates. */}
            {row.match_status === 'UNMATCHED' ? (
              <section>
                <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-50/40 p-4 dark:bg-amber-950/30">
                  <SearchX className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                      Ingen exakt matchning hittades
                    </p>
                    <p className="text-xs leading-relaxed text-amber-900/80 dark:text-amber-300">
                      Lagen kan finnas i katalogen under ett annat SFS-nummer än
                      det källraden refererar till. Kontrollera kandidaterna
                      nedan innan du begär tillägg.
                    </p>
                  </div>
                </div>
              </section>
            ) : (
              <section>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Matchat dokument
                </p>
                {row.matched_document ? (
                  <div className="mt-2 rounded-lg border bg-muted/30 p-3">
                    <p className="font-medium leading-tight">
                      {row.matched_document.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {row.matched_document.document_number}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getContentTypeLabel(
                          row.matched_document.content_type as ContentType
                        )}
                      </Badge>
                      <a
                        href={getDocumentUrl(
                          row.matched_document.content_type as ContentType,
                          row.matched_document.slug,
                          true
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                      >
                        Visa i katalogen
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm italic text-muted-foreground">
                    {row.match_status === 'CATALOG_REQUEST_PENDING'
                      ? 'Skickad till vår katalogsredaktion'
                      : 'Inget matchande dokument hittades'}
                  </p>
                )}
              </section>
            )}

            {/* Reasoning */}
            {row.match_reasoning && (
              <section>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Resonemang
                </p>
                <p className="mt-2 text-sm italic leading-relaxed text-muted-foreground">
                  {row.match_reasoning}
                </p>
              </section>
            )}

            {/* Alt candidates */}
            {otherCandidates.length > 0 && !readOnly && !decided && (
              <section>
                {row.match_status === 'UNMATCHED' ? (
                  <p className="text-sm font-medium">Stämmer någon av dessa?</p>
                ) : (
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Andra kandidater ({otherCandidates.length})
                  </p>
                )}
                <div className="mt-2 space-y-2">
                  {otherCandidates.map((c) => {
                    const isStaged = c.document_id === stagedCandidateId
                    return (
                      <button
                        key={c.document_id}
                        type="button"
                        onClick={() =>
                          setStagedCandidateId(isStaged ? null : c.document_id)
                        }
                        disabled={isPending}
                        aria-pressed={isStaged}
                        className={`group flex w-full items-center gap-3 rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 ${
                          isStaged
                            ? 'border-primary bg-primary/10 ring-1 ring-primary'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium leading-tight">
                            {c.title}
                          </div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {c.document_number ?? c.content_type}
                          </div>
                        </div>
                        {c.fuzzy_score >= 0.45 && (
                          <span className="shrink-0 rounded-full border bg-muted/50 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                            {Math.round(c.fuzzy_score * 100)}%
                          </span>
                        )}
                        {isStaged ? (
                          <Check
                            className="h-4 w-4 shrink-0 text-primary"
                            aria-label="Vald"
                          />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Footer actions */}
          {!readOnly && !decided && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
              {row.match_status === 'UNMATCHED' ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={handleReject}
                    disabled={isPending}
                  >
                    Avvisa
                  </Button>
                  {hasStaging ? (
                    <Button onClick={handleAccept} disabled={isPending}>
                      Acceptera
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setCatalogDialogOpen(true)}
                      disabled={isPending}
                    >
                      Begär tillägg
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={handleReject}
                    disabled={isPending}
                  >
                    Avvisa
                  </Button>
                  <Button onClick={handleAccept} disabled={isPending}>
                    Acceptera
                  </Button>
                </>
              )}
            </div>
          )}
          {!readOnly && decided && (
            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button
                variant="outline"
                onClick={handleUndo}
                disabled={
                  isPending || row.match_status === 'CATALOG_REQUEST_FULFILLED'
                }
              >
                Ångra beslut
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Catalog-add note dialog */}
      <Dialog open={catalogDialogOpen} onOpenChange={setCatalogDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Begär att vi lägger till dokumentet</DialogTitle>
            <DialogDescription>
              Vi lägger till lagar inom 24 timmar. Lägg gärna till en kommentar
              om vad du letar efter — det hjälper oss hitta rätt.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={catalogNote}
            onChange={(e) => setCatalogNote(e.target.value)}
            placeholder={`t.ex. "Avser den nya AFS-föreskriften från ${new Date().getFullYear()}"`}
            maxLength={1000}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCatalogDialogOpen(false)}
              disabled={isPending}
            >
              Avbryt
            </Button>
            <Button onClick={handleCatalogRequest} disabled={isPending}>
              Skicka begäran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
