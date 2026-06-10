import Link from 'next/link'
import { ExternalLink, Scale } from 'lucide-react'
import { ContentType } from '@prisma/client'
import type { CatalogLawEntry } from '@/lib/marketing/frontmatter-schemas'
import {
  resolveCatalogLinks,
  type ResolvedCatalogLink,
} from '@/lib/marketing/catalog-link'

/**
 * Live catalog-link list (Story 26.3) — resolves frontmatter entries against
 * real LegalDocument rows server-side (one batched query, build time) and
 * renders verified links into /lagar/*, /foreskrifter/* and /eu/*.
 * Unmatched entries degrade to muted plain text (and log
 * [CATALOG_LINK_UNMATCHED] from the resolver) so a half-fixed page never
 * shows a dead link.
 *
 * Prop contract unchanged from the 26.1 stub — templates and MDX untouched.
 */

const GROUPS: Array<{ heading: string; types: ContentType[] }> = [
  {
    heading: 'Lagar & förordningar',
    types: [ContentType.SFS_LAW, ContentType.SFS_AMENDMENT],
  },
  { heading: 'Föreskrifter', types: [ContentType.AGENCY_REGULATION] },
  {
    heading: 'EU-regler',
    types: [ContentType.EU_REGULATION, ContentType.EU_DIRECTIVE],
  },
]

function LinkRows({ links }: { links: ResolvedCatalogLink[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {links.map((link, i) => (
        <li key={`${link.title}-${i}`}>
          {link.href ? (
            <Link
              href={link.href}
              className="group flex items-center justify-between gap-4 px-5 py-3.5 text-sm text-foreground transition-colors hover:bg-secondary/50"
            >
              <span className="font-medium">{link.title}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            </Link>
          ) : (
            <span className="flex px-5 py-3.5 text-sm text-muted-foreground">
              {link.title}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

export async function CatalogLawList({
  heading = 'Lagar och föreskrifter som berör området',
  intro,
  entries,
  groupBy,
  context,
}: {
  heading?: string | undefined
  /** optional subtitle under the heading */
  intro?: string | undefined
  entries: CatalogLawEntry[]
  /** group matched links under Swedish content-type headings */
  groupBy?: 'content_type' | undefined
  /** page identifier for unmatched-link warnings, e.g. "branscher/bygg" */
  context?: string | undefined
}) {
  if (entries.length === 0) return null

  const resolved = await resolveCatalogLinks(entries, context)

  let body: React.ReactNode
  if (groupBy === 'content_type') {
    const grouped = GROUPS.map((group) => ({
      heading: group.heading,
      links: resolved.filter(
        (l) => l.contentType && group.types.includes(l.contentType)
      ),
    })).filter((g) => g.links.length > 0)
    const unmatched = resolved.filter((l) => l.status === 'unmatched')

    body = (
      <div className="space-y-6">
        {grouped.map((group) => (
          <div key={group.heading}>
            <p className="mb-2.5 font-safiro text-[13px] font-medium text-muted-foreground">
              {group.heading}
            </p>
            <LinkRows links={group.links} />
          </div>
        ))}
        {unmatched.length > 0 && <LinkRows links={unmatched} />}
      </div>
    )
  } else {
    body = <LinkRows links={resolved} />
  }

  return (
    <section className="container mx-auto px-4 py-14 md:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground/70">
              <Scale className="h-4.5 w-4.5" />
            </span>
            <h2 className="font-safiro text-xl font-medium tracking-tight text-foreground md:text-2xl">
              {heading}
            </h2>
          </div>
          {intro && (
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              {intro}
            </p>
          )}
        </div>
        {body}
      </div>
    </section>
  )
}
