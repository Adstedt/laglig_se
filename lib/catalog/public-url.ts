import { ContentType } from '@prisma/client'

/**
 * ContentType → public catalog URL path (Story 26.3, AC 1–2).
 *
 * Single source of truth shared by the sitemap generator
 * (scripts/generate-sitemaps.ts) and the marketing catalog-link resolver
 * (lib/marketing/catalog-link.ts) — the two can never drift.
 *
 * Verbatim move of the script's former `getUrlPath`. The `_exhaustive: never`
 * arm makes a future ContentType addition a TS build error instead of a
 * silent 404. Court cases return null — they have no public page yet.
 */
export function getPublicUrlPath(
  contentType: ContentType,
  slug: string
): string | null {
  switch (contentType) {
    case ContentType.SFS_LAW:
      return `/lagar/${slug}`
    case ContentType.SFS_AMENDMENT:
      return `/lagar/andringar/${slug}`
    case ContentType.AGENCY_REGULATION:
      return `/foreskrifter/${slug}`
    case ContentType.EU_REGULATION:
      return `/eu/forordningar/${slug}`
    case ContentType.EU_DIRECTIVE:
      return `/eu/direktiv/${slug}`
    case ContentType.COURT_CASE_AD:
    case ContentType.COURT_CASE_HD:
    case ContentType.COURT_CASE_HOVR:
    case ContentType.COURT_CASE_HFD:
    case ContentType.COURT_CASE_MOD:
    case ContentType.COURT_CASE_MIG:
      return null
    default: {
      const _exhaustive: never = contentType
      void _exhaustive
      return null
    }
  }
}
