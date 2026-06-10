import type { ContentType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getPublicUrlPath } from '@/lib/catalog/public-url'
import type { CatalogLawEntry } from './frontmatter-schemas'

/**
 * Catalog-link resolver (Story 26.3) — the unique-defensible move: marketing
 * pages link into the live LegalDocument catalog with verified hrefs and the
 * catalog's own titles, never hand-typed links.
 *
 * Server-only (prisma). Resolution cost lands at build time — marketing
 * pages are SSG'd.
 */

export interface ResolvedCatalogLink {
  title: string
  /** verified public URL (+#anchor) — null when unmatched */
  href: string | null
  status: 'matched' | 'unmatched'
  contentType?: ContentType
}

/**
 * Resolve frontmatter entries to verified catalog links in ONE batched query
 * (industry pages carry 10–20 entries; N+1 at build time is a pool-contention
 * risk — see 26.1 Debug Log). Matching precedence per entry: exact
 * document_number first, then slug. Only ACTIVE documents — repealed laws
 * aren't marketed.
 *
 * Unmatched entries (no row, or a content type with no public page) resolve
 * to plain text and log [CATALOG_LINK_UNMATCHED] so editorial can fix the MDX.
 *
 * @param context page identifier for the warning log, e.g. "branscher/bygg"
 */
export async function resolveCatalogLinks(
  entries: CatalogLawEntry[],
  context?: string
): Promise<ResolvedCatalogLink[]> {
  if (entries.length === 0) return []

  const documentNumbers = entries
    .map((e) => e.documentNumber)
    .filter((v): v is string => Boolean(v))
  const slugs = entries
    .map((e) => e.slug)
    .filter((v): v is string => Boolean(v))

  const rows = await prisma.legalDocument.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        ...(documentNumbers.length
          ? [{ document_number: { in: documentNumbers } }]
          : []),
        ...(slugs.length ? [{ slug: { in: slugs } }] : []),
      ],
    },
    select: {
      document_number: true,
      slug: true,
      title: true,
      content_type: true,
    },
  })

  const byDocumentNumber = new Map(rows.map((r) => [r.document_number, r]))
  const bySlug = new Map(rows.map((r) => [r.slug, r]))

  return entries.map((entry) => {
    const row =
      (entry.documentNumber
        ? byDocumentNumber.get(entry.documentNumber)
        : undefined) ?? (entry.slug ? bySlug.get(entry.slug) : undefined)

    const fallbackTitle =
      entry.title ?? entry.documentNumber ?? entry.slug ?? ''

    if (!row) {
      warnUnmatched(entry, context, 'no ACTIVE catalog row')
      return { title: fallbackTitle, href: null, status: 'unmatched' as const }
    }

    const path = getPublicUrlPath(row.content_type, row.slug)
    if (!path) {
      warnUnmatched(entry, context, `no public page for ${row.content_type}`)
      return {
        title: row.title || fallbackTitle,
        href: null,
        status: 'unmatched' as const,
        contentType: row.content_type,
      }
    }

    return {
      // The catalog is the title authority; frontmatter only fills gaps.
      title: row.title || fallbackTitle,
      href: entry.anchor ? `${path}#${entry.anchor}` : path,
      status: 'matched' as const,
      contentType: row.content_type,
    }
  })
}

function warnUnmatched(
  entry: CatalogLawEntry,
  context: string | undefined,
  reason: string
): void {
  const id = entry.documentNumber ?? entry.slug ?? entry.title ?? '(empty)'
  console.warn(
    `[CATALOG_LINK_UNMATCHED]${context ? ` ${context}:` : ''} "${id}" — ${reason}`
  )
}
