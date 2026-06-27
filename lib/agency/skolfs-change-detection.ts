/**
 * SKOLFS amendment-detection — the pure signal classifier (Story 9.8, Task 1).
 *
 * SKOLFS detection is a *state-diff over one JSON document* the cron already
 * fetches: `validity` flips and `latestChangeBySkolfsNo` advancing ARE the
 * signal, and `relatedDocumentMetadata` (normalized here as `amendmentChain`)
 * carries the full amendment graph with per-amendment validity/effectiveDate.
 *
 * `classifySkolfsDiff` is deliberately PURE and lives in `lib/` (not buried in
 * the route handler) so it can be unit-tested in isolation against fixtures for
 * every transition (AC 2/3, Testing requirements). The route handler
 * (`app/api/cron/discover-skolfs-changes`) wires it to the live poll, the
 * content-hash guard, re-ingest, and ChangeEvent emission + dedup (AC 4/5).
 *
 * [Source: Story 9.8 AC 2/3; Story 9.7 AC 9 baseline `metadata.skolfs`]
 */

export type SkolfsValidity = 'VALID' | 'EXPIRED' | 'UPCOMING'

/**
 * One amendment in a base's chain — mirrors the enumerator's
 * `AmendmentChainEntry` and the API `relatedDocumentMetadata` entries.
 */
export interface SkolfsAmendmentRef {
  skolfsNumber: string
  validity: SkolfsValidity
  effectiveDate: string | null
  change: string | null
}

/**
 * The diff-relevant slice of a SKOLFS base's state. Both the stored baseline
 * (read from `LegalDocument.metadata.skolfs` + `document_number`) and the fresh
 * poll (a registry entry from the 9.7 enumerator) are projected to this shape so
 * the classifier compares like with like.
 */
export interface SkolfsSnapshot {
  documentNumber: string // "SKOLFS 2024:616"
  validity: SkolfsValidity
  isConsolidated: boolean
  latestChangeBySkolfsNo: string | null
  /** the in-force effective date of the base/consolidation (for NEW_LAW dating) */
  effectiveDate?: string | null
  /** base document type (GRUNDFORFATTNING | ALLMANNA_RAD_OVRIGT) — the per-doc
   * metadata endpoint; classifier ignores it, the enrichment fetch needs it */
  documentType?: string
  amendmentChain: SkolfsAmendmentRef[]
  /** UPCOMING subset of the chain; derived from `amendmentChain` when absent */
  upcoming?: SkolfsAmendmentRef[]
}

export type SkolfsSignalKind =
  | 'NEW_LAW'
  | 'AMENDMENT'
  | 'REPEAL'
  | 'UPCOMING_AMENDMENT'

export interface SkolfsSignal {
  kind: SkolfsSignalKind
  documentNumber: string
  /**
   * The amending SKOLFS number this signal is keyed on (AMENDMENT /
   * UPCOMING_AMENDMENT). `null` for NEW_LAW and REPEAL, which key on the base
   * itself. Used as the `amendment_sfs` dedup key (AC 5).
   */
  amendmentSkolfsNo: string | null
  effectiveDate: string | null
  /** the API `change` string, e.g. "ändr. 5, 6 §§" — feeds `changed_sections` */
  changedSections: string | null
  /** human-readable rationale — feeds `ai_summary` / run logs */
  reason: string
}

export interface ClassifyOptions {
  /**
   * First detector run for this base: emit UPCOMING_AMENDMENT for *every*
   * pending amendment already captured in the 9.7 baseline (one-time backfill,
   * AC 2). Deduped downstream on `(document_id, amendmentSkolfsNo)` (AC 5) so it
   * never repeats. On subsequent runs (default) only *newly appeared* upcoming
   * amendments emit.
   */
  firstRun?: boolean
}

/** The UPCOMING amendments of a snapshot — `upcoming` if set, else chain-derived. */
function upcomingOf(s: SkolfsSnapshot): SkolfsAmendmentRef[] {
  if (s.upcoming && s.upcoming.length > 0) return s.upcoming
  return s.amendmentChain.filter((a) => a.validity === 'UPCOMING')
}

/**
 * Detect an *in-force* amendment between baseline and current, returning the
 * amending SKOLFS number (and its chain entry) or `null`. Three triggers, per
 * AC 2: (1) `latestChangeBySkolfsNo` advanced; (2) a chain amendment that was
 * UPCOMING in the baseline is now VALID; (3) a new VALID consolidation
 * (SENASTE_LYDELSE) appeared for the base. A fourth, statute-only-robust
 * trigger generalizes (1)+(2): any VALID amendment now in the chain that was
 * absent from the baseline chain — this catches a brand-new immediately-in-force
 * amendment even when `latestChangeBySkolfsNo` isn't populated (the cheap
 * single-poll pass derives the chain from the statute list without it).
 */
function detectInForceAmendment(
  baseline: SkolfsSnapshot,
  current: SkolfsSnapshot
): SkolfsAmendmentRef | { skolfsNumber: string | null } | null {
  // (2) A previously-pending amendment flipped UPCOMING → VALID. This is the
  // most specific "what changed" signal, so prefer it.
  const baselineUpcomingNos = new Set(
    upcomingOf(baseline).map((u) => u.skolfsNumber)
  )
  const flipped = current.amendmentChain.find(
    (a) => a.validity === 'VALID' && baselineUpcomingNos.has(a.skolfsNumber)
  )
  if (flipped) return flipped

  // (4) A new VALID amendment appeared in the chain that we did not have at all
  // (published already-in-force, skipping our UPCOMING capture). Robust to a
  // missing `latestChangeBySkolfsNo` (statute-only poll).
  const baselineChainNos = new Set(
    baseline.amendmentChain.map((a) => a.skolfsNumber)
  )
  const freshValid = current.amendmentChain.find(
    (a) => a.validity === 'VALID' && !baselineChainNos.has(a.skolfsNumber)
  )
  if (freshValid) return freshValid

  // (1) latestChangeBySkolfsNo advanced (a new in-force change was published).
  if (
    current.latestChangeBySkolfsNo &&
    current.latestChangeBySkolfsNo !== baseline.latestChangeBySkolfsNo
  ) {
    const ref = current.amendmentChain.find(
      (a) => a.skolfsNumber === current.latestChangeBySkolfsNo
    )
    return ref ?? { skolfsNumber: current.latestChangeBySkolfsNo }
  }

  // (3) A new VALID consolidation appeared (base → consolidated) without
  // latestChangeBySkolfsNo moving. Key on whatever the latest change is.
  if (!baseline.isConsolidated && current.isConsolidated) {
    const ref = current.amendmentChain.find(
      (a) => a.skolfsNumber === current.latestChangeBySkolfsNo
    )
    return ref ?? { skolfsNumber: current.latestChangeBySkolfsNo }
  }

  return null
}

/**
 * Classify the diff between a stored baseline and the current polled state into
 * zero or more change signals. Pure — no I/O, no DB. A single base can yield
 * both an AMENDMENT (an in-force change) and one or more UPCOMING_AMENDMENT
 * signals (still-pending changes), so the return is an array.
 *
 * @param baseline the stored snapshot, or `null` if we have never ingested this base
 * @param current  the freshly-polled snapshot
 */
export function classifySkolfsDiff(
  baseline: SkolfsSnapshot | null,
  current: SkolfsSnapshot,
  opts: ClassifyOptions = {}
): SkolfsSignal[] {
  const firstRun = opts.firstRun ?? false
  const signals: SkolfsSignal[] = []
  const doc = current.documentNumber

  // NEW_LAW — a base we don't have appears (brand-new, or UPCOMING → VALID).
  // EXCLUDED corpus (still UPCOMING / EXPIRED) we don't have stays out.
  if (!baseline) {
    if (current.validity === 'VALID') {
      signals.push({
        kind: 'NEW_LAW',
        documentNumber: doc,
        amendmentSkolfsNo: null,
        effectiveDate: current.effectiveDate ?? null,
        changedSections: null,
        reason: `Ny gällande SKOLFS-författning (${doc}) upptäckt.`,
      })
    }
    return signals
  }

  // REPEAL — the base flipped VALID → EXPIRED. Terminal: no further signals.
  if (baseline.validity === 'VALID' && current.validity === 'EXPIRED') {
    signals.push({
      kind: 'REPEAL',
      documentNumber: doc,
      amendmentSkolfsNo: null,
      effectiveDate: current.effectiveDate ?? null,
      changedSections: null,
      reason: `${doc} har upphävts (gällande → upphävd).`,
    })
    return signals
  }

  // Remaining signals are only meaningful while the base is in force.
  if (current.validity === 'VALID') {
    // AMENDMENT — an in-force change.
    const amend = detectInForceAmendment(baseline, current)
    if (amend) {
      const ref = 'validity' in amend ? amend : null
      signals.push({
        kind: 'AMENDMENT',
        documentNumber: doc,
        amendmentSkolfsNo: amend.skolfsNumber,
        effectiveDate: ref?.effectiveDate ?? null,
        changedSections: ref?.change ?? null,
        reason: amend.skolfsNumber
          ? `${doc} ändrad genom ${amend.skolfsNumber}${
              ref?.change ? ` (${ref.change})` : ''
            }.`
          : `${doc} har en ny gällande lydelse.`,
      })
    }

    // UPCOMING_AMENDMENT — pending (kommande) changes. On firstRun, emit every
    // pending amendment (baseline backfill). Otherwise only those not already in
    // the baseline's pending set. Dedup on (doc, amendmentSkolfsNo) keeps both
    // one-time (AC 5).
    const baselineUpcomingNos = new Set(
      upcomingOf(baseline).map((u) => u.skolfsNumber)
    )
    for (const u of upcomingOf(current)) {
      const isNew = firstRun || !baselineUpcomingNos.has(u.skolfsNumber)
      if (!isNew) continue
      signals.push({
        kind: 'UPCOMING_AMENDMENT',
        documentNumber: doc,
        amendmentSkolfsNo: u.skolfsNumber,
        effectiveDate: u.effectiveDate,
        changedSections: u.change,
        reason: `Kommande ändring av ${doc} genom ${u.skolfsNumber}${
          u.effectiveDate ? ` träder i kraft ${u.effectiveDate}` : ''
        }${u.change ? ` (${u.change})` : ''}.`,
      })
    }
  }

  return signals
}

/**
 * Fold per-candidate enrichment (the `change` string + effective date the cheap
 * statute poll omits) into an AMENDMENT / UPCOMING_AMENDMENT signal, rebuilding
 * the Swedish `ai_summary` text. No-op for NEW_LAW / REPEAL. Pure.
 */
export function enrichSignal(
  signal: SkolfsSignal,
  detail: { effectiveDate: string | null; change: string | null }
): SkolfsSignal {
  if (signal.kind !== 'AMENDMENT' && signal.kind !== 'UPCOMING_AMENDMENT') {
    return signal
  }
  const effectiveDate = signal.effectiveDate ?? detail.effectiveDate
  const changedSections = signal.changedSections ?? detail.change
  const amend = signal.amendmentSkolfsNo
  const reason =
    signal.kind === 'AMENDMENT'
      ? `${signal.documentNumber} ändrad genom ${amend}${
          changedSections ? ` (${changedSections})` : ''
        }${effectiveDate ? `, i kraft ${effectiveDate}` : ''}.`
      : `Kommande ändring av ${signal.documentNumber} genom ${amend}${
          effectiveDate ? ` träder i kraft ${effectiveDate}` : ''
        }${changedSections ? ` (${changedSections})` : ''}.`
  return { ...signal, effectiveDate, changedSections, reason }
}

/**
 * Project a `LegalDocument.metadata.skolfs` baseline (Story 9.7 AC 9) onto a
 * `SkolfsSnapshot`. Tolerant of the loosely-typed JSON shape. Returns `null`
 * when the metadata has no `skolfs` block (treat as "not previously ingested").
 */
export function snapshotFromBaselineMetadata(
  documentNumber: string,
  metadata: unknown
): SkolfsSnapshot | null {
  if (typeof metadata !== 'object' || metadata === null) return null
  const m = metadata as Record<string, unknown>
  const skolfs = m.skolfs
  if (typeof skolfs !== 'object' || skolfs === null) return null
  const s = skolfs as Record<string, unknown>
  return {
    documentNumber,
    validity: (s.validity as SkolfsValidity) ?? 'VALID',
    isConsolidated: Boolean(s.isConsolidated),
    latestChangeBySkolfsNo: (s.latestChangeBySkolfsNo as string | null) ?? null,
    effectiveDate: (m.effectiveDate as string | null) ?? null,
    amendmentChain: Array.isArray(s.amendmentChain)
      ? (s.amendmentChain as SkolfsAmendmentRef[])
      : [],
    upcoming: Array.isArray(s.upcoming)
      ? (s.upcoming as SkolfsAmendmentRef[])
      : [],
  }
}
