/**
 * Agency författningssamling prefix → issuing authority (regulatory_body).
 *
 * Single source of truth for agency attribution, used by:
 *  - the agency-stub ingester (scripts/ingest-agency-stubs.ts)
 *  - the agency-attribution backfill (scripts/backfill-agency-attribution.ts)
 *  - the Socialstyrelsen HTML ingester (Story 9.5)
 *
 * `regulatory_body` is NOT derivable from the prefix for the shared HSLF-FS
 * series (it spans ~8 agencies); within Laglig's scope HSLF-FS rows are
 * Socialstyrelsen-issued, so the map resolves them accordingly. [Story 9.5]
 */
export const REGULATORY_BODY_MAP: Record<string, string> = {
  AFS: 'Arbetsmiljöverket',
  BFS: 'Boverket',
  NFS: 'Naturvårdsverket',
  KIFS: 'Kemikalieinspektionen',
  MSBFS: 'MSB (Myndigheten för samhällsskydd och beredskap)',
  'ELSÄK-FS': 'Elsäkerhetsverket',
  'ELSAK-FS': 'Elsäkerhetsverket',
  SRVFS: 'Räddningsverket (legacy)',
  SKVFS: 'Skatteverket',
  'HSLF-FS': 'Socialstyrelsen',
  SOSFS: 'Socialstyrelsen',
  TSFS: 'Transportstyrelsen',
  SJVFS: 'Jordbruksverket',
  LMFS: 'Lantmäteriet',
  SSMFS: 'Strålsäkerhetsmyndigheten',
  'SCB-FS': 'Statistiska centralbyrån',
  STEMFS: 'Energimyndigheten',
  SvKFS: 'Svenska kraftnät',
  FFFS: 'Finansinspektionen',
  FKFS: 'Försäkringskassan',
  HVMFS: 'Havs- och vattenmyndigheten',
  IMYFS: 'Integritetsskyddsmyndigheten',
  MIGRFS: 'Migrationsverket',
  PMFS: 'Polismyndigheten',
  PTSFS: 'Post- och telestyrelsen',
  SLVFS: 'Livsmedelsverket',
  LIVSFS: 'Livsmedelsverket',
  STAFS: 'Swedac',
}

/**
 * Extract the författningssamling prefix from a document number.
 * Preserves source casing. Returns null if the string isn't an agency number.
 *
 * "SOSFS 2011:9" → "SOSFS" · "HSLF-FS 2022:30" → "HSLF-FS" · "AFS 2023:15 kap. 8" → "AFS"
 */
export function parseAgencyPrefix(documentNumber: string): string | null {
  const match = documentNumber
    .trim()
    .match(/^([A-Za-zÅÄÖåäö][A-Za-zÅÄÖåäö-]*?)\s+\d{4}:\d+/)
  return match?.[1] ?? null
}

/** Resolve the issuing authority for a prefix (exact, then upper-case fallback). */
export function regulatoryBodyForPrefix(prefix: string): string | null {
  return (
    REGULATORY_BODY_MAP[prefix] ??
    REGULATORY_BODY_MAP[prefix.toUpperCase()] ??
    null
  )
}

/**
 * Derive `{ agencyPrefix, regulatoryBody }` from a document number — the canonical
 * attribution helper for AGENCY_REGULATION rows. Both fields are null for
 * non-agency numbers (SFS/EU/court); regulatoryBody is null for unknown prefixes.
 */
export function deriveAgencyAttribution(documentNumber: string): {
  agencyPrefix: string | null
  regulatoryBody: string | null
} {
  const agencyPrefix = parseAgencyPrefix(documentNumber)
  return {
    agencyPrefix,
    regulatoryBody: agencyPrefix ? regulatoryBodyForPrefix(agencyPrefix) : null,
  }
}
