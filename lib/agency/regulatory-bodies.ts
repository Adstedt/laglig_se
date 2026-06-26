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
 *
 * Some prefixes are *joint* författningssamlingar whose issuer genuinely
 * cannot be inferred from the prefix at all — see JOINT_FORFATTNINGSSAMLINGAR
 * and resolveRegulatoryBody() below. [Story 9.7 — SKOLFS]
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
 * Joint författningssamlingar: prefixes whose issuer is NOT determined by the
 * prefix because the collection is shared across multiple issuing bodies. For
 * these, the issuer MUST be resolved per-document (e.g. from the source API's
 * `issuedBy`), NOT via REGULATORY_BODY_MAP.
 *
 * ⚠️ DO NOT add SKOLFS to REGULATORY_BODY_MAP. SKOLFS (Skolverkets
 * författningssamling) carries documents from Skolverket, Regeringen
 * (läroplaner/förordningar), Skolinspektionen and Specialpedagogiska
 * skolmyndigheten — the prefix alone cannot tell them apart. Mapping it to a
 * single body would mis-attribute the Government's curricula. [Story 9.7]
 */
export const JOINT_FORFATTNINGSSAMLINGAR = new Set<string>(['SKOLFS'])

/** True if the prefix is a joint samling requiring per-document issuer resolution. */
export function isJointForfattningssamling(prefix: string | null): boolean {
  if (!prefix) return false
  return (
    JOINT_FORFATTNINGSSAMLINGAR.has(prefix) ||
    JOINT_FORFATTNINGSSAMLINGAR.has(prefix.toUpperCase())
  )
}

/**
 * Resolve `regulatory_body` for an AGENCY_REGULATION document, honoring the
 * joint-samling rule: for a joint prefix (e.g. SKOLFS) the per-document
 * `issuedBy` (from the source API) wins and the prefix map is NOT consulted;
 * for single-publisher prefixes, fall back to REGULATORY_BODY_MAP. Returns null
 * when a joint doc has no issuedBy, or a single-publisher prefix is unknown.
 */
export function resolveRegulatoryBody(
  documentNumber: string,
  issuedBy?: string | null
): string | null {
  const prefix = parseAgencyPrefix(documentNumber)
  if (isJointForfattningssamling(prefix)) {
    return issuedBy?.trim() || null
  }
  return prefix ? regulatoryBodyForPrefix(prefix) : null
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
