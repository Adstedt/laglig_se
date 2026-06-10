import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { NavbarV3 } from '@/components/features/landing-v3/navbar-v3'
import { FooterV3 } from '@/components/features/landing-v3/footer-v3'
import { getPublishedMarketingRoutes } from '@/lib/marketing/content'

/**
 * Shared chrome for all marketing pages (Story 26.1 AC 8).
 *
 * Composes the LANDING-V3 chrome — not components/shared/navigation — so the
 * conversion funnel is visually continuous from `/` (decision recorded in
 * Epic 26 v0.2). Story 26.2 points NavbarV3's megamenu at these routes.
 */
export function MarketingShell({
  breadcrumbs,
  children,
}: {
  /** e.g. [{ label: 'Branscher' }, { label: 'Bygg', current: true }] */
  breadcrumbs: Array<{ label: string; href?: string; current?: boolean }>
  children: React.ReactNode
}) {
  const publishedRoutes = getPublishedMarketingRoutes()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <NavbarV3 publishedRoutes={publishedRoutes} />
      <nav
        aria-label="Brödsmulor"
        className="container mx-auto px-4 pt-6 text-xs text-muted-foreground"
      >
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="transition-colors hover:text-foreground">
              Hem
            </Link>
          </li>
          {breadcrumbs.map((crumb) => (
            <li key={crumb.label} className="flex items-center gap-1.5">
              <ChevronRight aria-hidden className="h-3 w-3" />
              {crumb.href && !crumb.current ? (
                <Link
                  href={crumb.href}
                  className="transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={crumb.current ? 'page' : undefined}
                  className="font-medium text-foreground"
                >
                  {crumb.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <main className="flex-1">{children}</main>
      <FooterV3 publishedRoutes={publishedRoutes} />
    </div>
  )
}
