/**
 * SKOLFS API client + state projection (Story 9.8).
 *
 * The detector cron polls `GET /api/statute?size=20000` ONCE for the full
 * current state (AC 1). The statute list carries every doc's `validity`,
 * `documentType` and `baseSkolfsNumber` — enough to project each base into a
 * `SkolfsSnapshot` (validity, amendment chain, consolidation) for diffing,
 * WITHOUT the per-doc metadata fetches the 9.7 enumerator does. The exact
 * `change` string / `effectiveDate` per amendment (only needed for the
 * `ai_summary` of a confirmed change) are enriched per-candidate in Task 2.
 *
 * This mirrors the enumerator's corpus rule (VALID GRUNDFORFATTNING +
 * ALLMANNA_RAD_OVRIGT, consolidated-by-base) so the detector reuses the 9.7
 * pipeline's semantics rather than forking them.
 * [Source: scripts/enumerate-skolverket-foreskrifter.ts:148-243; Story 9.8 AC 1]
 */

import type {
  SkolfsSnapshot,
  SkolfsValidity,
  SkolfsAmendmentRef,
} from './skolfs-change-detection'

export const SKOLFS_API = 'https://skolfs.skolverket.se/api'

const USER_AGENT =
  'laglig.se monitoring (+https://laglig.se; SKOLFS amendment detector)'

export type SkolfsDocumentType =
  | 'GRUNDFORFATTNING'
  | 'ANDRINGSFORFATTNING'
  | 'SENASTE_LYDELSE'
  | 'ALLMANNA_RAD_OVRIGT'

export interface SkolfsStatuteHit {
  skolfsNumber: string
  baseSkolfsNumber: string
  statuteTitle: string
  documentType: SkolfsDocumentType
  validity: SkolfsValidity
}

/** Document types that are first-class catalog bases (not amendment acts). */
const BASE_TYPES: ReadonlySet<SkolfsDocumentType> = new Set([
  'GRUNDFORFATTNING',
  'ALLMANNA_RAD_OVRIGT',
])

interface StatuteResponse {
  searchGroups?: { searchHits?: SkolfsStatuteHit[] }[]
}

/** One `GET /api/statute?size=20000` → flattened hit list (~5,400 docs). */
export async function fetchSkolfsStatute(
  fetchImpl: typeof fetch = fetch
): Promise<SkolfsStatuteHit[]> {
  const res = await fetchImpl(`${SKOLFS_API}/statute?size=20000`, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!res.ok) {
    throw new Error(`SKOLFS statute poll failed: HTTP ${res.status}`)
  }
  const json = (await res.json()) as StatuteResponse
  return (json.searchGroups ?? []).flatMap((g) => g.searchHits ?? [])
}

/**
 * Project the raw statute list into per-base current snapshots, keyed by
 * `document_number` ("SKOLFS YYYY:N"). Includes EXPIRED bases (so a
 * VALID → EXPIRED repeal is visible against the stored baseline) but excludes
 * pure amendment acts and consolidations as standalone bases — those fold into
 * their base's `amendmentChain` / `isConsolidated`. Pure: no I/O.
 */
export function buildCurrentSnapshots(
  hits: SkolfsStatuteHit[]
): Map<string, SkolfsSnapshot> {
  // Index amendments + valid consolidations by base.
  const amendmentsByBase = new Map<string, SkolfsAmendmentRef[]>()
  const consolidatedBases = new Set<string>()
  for (const h of hits) {
    if (h.documentType === 'ANDRINGSFORFATTNING') {
      const list = amendmentsByBase.get(h.baseSkolfsNumber) ?? []
      list.push({
        skolfsNumber: h.skolfsNumber,
        validity: h.validity,
        effectiveDate: null, // enriched per-candidate in Task 2
        change: null,
      })
      amendmentsByBase.set(h.baseSkolfsNumber, list)
    } else if (h.documentType === 'SENASTE_LYDELSE' && h.validity === 'VALID') {
      consolidatedBases.add(h.baseSkolfsNumber)
    }
  }

  const snapshots = new Map<string, SkolfsSnapshot>()
  for (const h of hits) {
    if (!BASE_TYPES.has(h.documentType)) continue
    const chain = amendmentsByBase.get(h.skolfsNumber) ?? []
    snapshots.set(`SKOLFS ${h.skolfsNumber}`, {
      documentNumber: `SKOLFS ${h.skolfsNumber}`,
      validity: h.validity,
      isConsolidated: consolidatedBases.has(h.skolfsNumber),
      latestChangeBySkolfsNo: null, // not in the statute list; enriched if needed
      effectiveDate: null,
      documentType: h.documentType,
      amendmentChain: chain,
      upcoming: chain.filter((a) => a.validity === 'UPCOMING'),
    })
  }
  return snapshots
}

// ---------------------------------------------------------------------------
// Per-candidate enrichment (Task 2)
// ---------------------------------------------------------------------------

interface SkolfsDocMetaResponse {
  issuedBy?: string | null
  effectiveDate?: string | null
  latestChangeBySkolfsNo?: string | null
  relatedDocumentMetadata?: {
    skolfsNumber: string
    documentType: SkolfsDocumentType
    validity: SkolfsValidity
    effectiveDate?: string | null
    change?: string | null
  }[]
}

export interface SkolfsAmendmentDetail {
  effectiveDate: string | null
  change: string | null
}

/**
 * Fetch a single base's metadata (`GET /api/document/{TYPE}/{nr}`) and index its
 * amendment chain by SKOLFS number → `{ effectiveDate, change }`. Used to enrich
 * the (few) signalled candidates with the `change` string + effective date the
 * cheap statute poll omits. Returns an empty map on any fetch error (the signal
 * still emits, just without the enriched section text).
 */
export async function fetchAmendmentDetails(
  documentType: string,
  baseSkolfsNumber: string,
  fetchImpl: typeof fetch = fetch
): Promise<Map<string, SkolfsAmendmentDetail>> {
  const details = new Map<string, SkolfsAmendmentDetail>()
  try {
    const res = await fetchImpl(
      `${SKOLFS_API}/document/${documentType}/${baseSkolfsNumber}`,
      { headers: { 'User-Agent': USER_AGENT } }
    )
    if (!res.ok) return details
    const json = (await res.json()) as SkolfsDocMetaResponse
    for (const r of json.relatedDocumentMetadata ?? []) {
      details.set(r.skolfsNumber, {
        effectiveDate: r.effectiveDate ?? null,
        change: r.change ?? null,
      })
    }
  } catch {
    // best-effort enrichment — leave details empty
  }
  return details
}
