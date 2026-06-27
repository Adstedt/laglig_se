/* eslint-disable no-console */
/**
 * Story 9.7 — Task 2: SKOLFS (Skolverket) API enumerator.
 *
 * Enumerates the GÄLLANDE SKOLFS corpus via the public JSON API (no headless
 * browser, no auth) and writes a registry the ingester consumes.
 *
 *   GET https://skolfs.skolverket.se/api/statute?size=20000   → all 5,421 docs
 *   GET /api/document/{TYPE}/{nr}                              → per-doc metadata
 *
 * Corpus rule (verified live 2026-06-25):
 *   KEEP  validity == VALID AND documentType ∈ {GRUNDFORFATTNING, ALLMANNA_RAD_OVRIGT}
 *   PDF   prefer a VALID SENASTE_LYDELSE for the base; else the base PDF
 *   DROP  EXPIRED (superseded/repealed), VALID ANDRINGSFORFATTNING (change events),
 *         UPCOMING (not in force — surfaced via 9.8's upcoming feed)
 *   DEDUP consolidated-by-base (SKOLFS 2011:22 lists its consolidated entry twice)
 *
 * Attribution: SKOLFS is a JOINT författningssamling → issuer read per-document
 * from the GRUNDFORFATTNING/ALLMANNA_RAD_OVRIGT endpoint's `issuedBy`
 * (SENASTE_LYDELSE returns issuedBy: null). [Story 9.7 AC 3/4/5/8]
 *
 * Usage:
 *   pnpm tsx scripts/enumerate-skolverket-foreskrifter.ts --limit 5   # dev sample
 *   pnpm tsx scripts/enumerate-skolverket-foreskrifter.ts             # full ~1,400
 */
import { resolve } from 'path'
import { writeFileSync } from 'fs'

const API = 'https://skolfs.skolverket.se/api'
const USER_AGENT = 'Mozilla/5.0 (compatible; LagligBot/1.0; +https://laglig.se)'
const REGISTRY_OUT = resolve(
  process.cwd(),
  'data/skolverket-foreskrifter-registry.json'
)
const THROTTLE_MS = 150

type DocumentType =
  | 'GRUNDFORFATTNING'
  | 'ANDRINGSFORFATTNING'
  | 'SENASTE_LYDELSE'
  | 'ALLMANNA_RAD_OVRIGT'
type Validity = 'VALID' | 'EXPIRED' | 'UPCOMING'

interface StatuteHit {
  skolfsNumber: string
  baseSkolfsNumber: string
  statuteTitle: string
  documentType: DocumentType
  validity: Validity
  relatedSkolfs: boolean
}

interface RelatedDocMeta {
  skolfsNumber: string
  documentType: DocumentType
  validity: Validity
  effectiveDate?: string | null
  change?: string | null
}

interface DocMeta {
  skolfsNumber: string
  statuteTitle: string
  issuedBy?: string | null
  decisionDate?: string | null
  effectiveDate?: string | null
  promulgationDate?: string | null
  latestChange?: string | null
  latestChangeBySkolfsNo?: string | null
  validity: Validity
  relatedDocumentMetadata?: RelatedDocMeta[]
}

interface AmendmentChainEntry {
  skolfsNumber: string
  validity: Validity
  effectiveDate: string | null
  change: string | null
}

interface RegistryEntry {
  documentNumber: string // "SKOLFS 2011:144"
  title: string
  documentType: DocumentType
  validity: Validity
  isConsolidated: boolean
  baseSkolfsNumber: string
  pdfType: DocumentType // which PDF to fetch
  pdfUrl: string
  sourceUrl: string
  issuedBy: string | null
  regulatoryBody: string | null
  agencyPrefix: 'SKOLFS'
  decisionDate: string | null
  effectiveDate: string | null
  promulgationDate: string | null
  latestChange: string | null
  latestChangeBySkolfsNo: string | null
  amendmentChain: AmendmentChainEntry[]
  upcoming: AmendmentChainEntry[]
}

const cleanTitle = (t: string): string => t.replace(/\s+/g, ' ').trim()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Fallback issuer when the API omits `issuedBy` — the ALLMANNA_RAD_OVRIGT
 * endpoint returns issuedBy: null, but the title carries the issuer in genitive
 * form ("Skolverkets allmänna råd…"). Only used when the API value is absent.
 */
function inferIssuerFromTitle(title: string): string | null {
  const m = title.match(
    /\b(Skolverket|Skolinspektionen|Specialpedagogiska skolmyndigheten)s?\b/
  )
  return m?.[1] ?? null
}

async function fetchJson<T>(url: string, attempt = 1): Promise<T> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return (await res.json()) as T
  } catch (err) {
    if (attempt >= 3) throw err
    await sleep(500 * attempt)
    return fetchJson<T>(url, attempt + 1)
  }
}

function parseArgs(): { limit: number } {
  const argv = process.argv.slice(2)
  let limit = 0
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit' && argv[i + 1]) {
      limit = parseInt(argv[i + 1]!, 10)
      i++
    }
  }
  return { limit }
}

async function main(): Promise<void> {
  const { limit } = parseArgs()
  console.log('='.repeat(60))
  console.log('SKOLFS Enumerator — Story 9.7 Task 2')
  console.log('='.repeat(60))

  // 1. Enumerate everything
  const all = await fetchJson<{ searchGroups: { searchHits: StatuteHit[] }[] }>(
    `${API}/statute?size=20000`
  )
  const hits = all.searchGroups.flatMap((g) => g.searchHits ?? [])
  console.log(`Fetched ${hits.length} total SKOLFS documents`)

  // 2. VALID consolidated, deduped by base
  const validConsolidatedBases = new Set<string>()
  for (const h of hits) {
    if (h.validity === 'VALID' && h.documentType === 'SENASTE_LYDELSE') {
      validConsolidatedBases.add(h.baseSkolfsNumber)
    }
  }

  // 3. The gällande readable corpus: VALID GRUNDFORFATTNING + ALLMANNA_RAD_OVRIGT
  let bases = hits.filter(
    (h) =>
      h.validity === 'VALID' &&
      (h.documentType === 'GRUNDFORFATTNING' ||
        h.documentType === 'ALLMANNA_RAD_OVRIGT')
  )
  console.log(
    `Corpus: ${bases.length} VALID bases ` +
      `(${bases.filter((b) => b.documentType === 'GRUNDFORFATTNING').length} grund + ` +
      `${bases.filter((b) => b.documentType === 'ALLMANNA_RAD_OVRIGT').length} råd); ` +
      `${validConsolidatedBases.size} have a VALID consolidation to prefer`
  )
  if (limit > 0) {
    bases = bases.slice(0, limit)
    console.log(`--limit ${limit}: enumerating ${bases.length} of the corpus`)
  }

  // 4. Per-doc metadata fetch → registry entries
  const registry: RegistryEntry[] = []
  for (let i = 0; i < bases.length; i++) {
    const base = bases[i]!
    const nr = base.skolfsNumber
    const preferConsolidated = validConsolidatedBases.has(nr)
    const pdfType: DocumentType = preferConsolidated
      ? 'SENASTE_LYDELSE'
      : base.documentType
    const pdfUrl = `${API}/document/${pdfType}/${nr}/pdf`

    // Issuer + dates + amendment chain come from the BASE endpoint
    // (SENASTE_LYDELSE has issuedBy: null), so always query the base's own type.
    let meta: DocMeta | null = null
    try {
      meta = await fetchJson<DocMeta>(
        `${API}/document/${base.documentType}/${nr}`
      )
    } catch (err) {
      console.warn(`  [meta-fail] SKOLFS ${nr}: ${(err as Error).message}`)
    }

    const related = meta?.relatedDocumentMetadata ?? []
    const amendmentChain: AmendmentChainEntry[] = related
      .filter((r) => r.documentType === 'ANDRINGSFORFATTNING')
      .map((r) => ({
        skolfsNumber: r.skolfsNumber,
        validity: r.validity,
        effectiveDate: r.effectiveDate ?? null,
        change: r.change ?? null,
      }))
    const upcoming = amendmentChain.filter((a) => a.validity === 'UPCOMING')

    registry.push({
      documentNumber: `SKOLFS ${nr}`,
      title: cleanTitle(base.statuteTitle),
      documentType: base.documentType,
      validity: base.validity,
      isConsolidated: preferConsolidated,
      baseSkolfsNumber: base.baseSkolfsNumber,
      pdfType,
      pdfUrl,
      sourceUrl: pdfUrl,
      issuedBy: meta?.issuedBy?.trim() || null, // raw API value (provenance)
      // joint samling → issuer = API issuedBy, with a title-based fallback for
      // ALLMANNA_RAD_OVRIGT (whose endpoint omits issuedBy).
      regulatoryBody:
        meta?.issuedBy?.trim() ||
        inferIssuerFromTitle(cleanTitle(base.statuteTitle)) ||
        null,
      agencyPrefix: 'SKOLFS',
      decisionDate: meta?.decisionDate ?? null,
      effectiveDate: meta?.effectiveDate ?? null,
      promulgationDate: meta?.promulgationDate ?? null,
      latestChange: meta?.latestChange ?? null,
      latestChangeBySkolfsNo: meta?.latestChangeBySkolfsNo ?? null,
      amendmentChain,
      upcoming,
    })

    if ((i + 1) % 50 === 0) console.log(`  …${i + 1}/${bases.length}`)
    await sleep(THROTTLE_MS)
  }

  // 5. Persist + summarize
  writeFileSync(REGISTRY_OUT, JSON.stringify(registry, null, 2) + '\n')
  const consolidated = registry.filter((r) => r.isConsolidated).length
  const withUpcoming = registry.filter((r) => r.upcoming.length > 0).length
  const issuers = new Map<string, number>()
  for (const r of registry)
    issuers.set(
      r.regulatoryBody ?? '(unknown)',
      (issuers.get(r.regulatoryBody ?? '(unknown)') ?? 0) + 1
    )

  console.log('-'.repeat(60))
  console.log(`Wrote ${registry.length} entries → ${REGISTRY_OUT}`)
  console.log(`  consolidated (SENASTE_LYDELSE) PDFs: ${consolidated}`)
  console.log(
    `  base PDFs:                          ${registry.length - consolidated}`
  )
  console.log(`  with UPCOMING amendment(s):         ${withUpcoming}`)
  console.log('  issuers:')
  for (const [body, n] of [...issuers.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${body}: ${n}`)
  }
  console.log('='.repeat(60))
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
