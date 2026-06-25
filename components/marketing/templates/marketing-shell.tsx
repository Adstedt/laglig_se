import { NavbarV3 } from '@/components/features/landing-v3/navbar-v3'
import { FooterV3 } from '@/components/features/landing-v3/footer-v3'
import { getPublishedMarketingRoutes } from '@/lib/marketing/content'

/**
 * Shared chrome for all marketing pages (Story 26.1 AC 8).
 *
 * Composes the LANDING-V3 chrome — not components/shared/navigation — so the
 * conversion funnel is visually continuous from `/` (decision recorded in
 * Epic 26 v0.2). Story 26.2 points NavbarV3's megamenu at these routes.
 *
 * No breadcrumb row: the hero eyebrow ("Bransch · Restaurang & hotell") already
 * orients the visitor, and the megamenu navbar handles up-navigation — a
 * separate "Hem › Branscher › …" trail was redundant and heavier-looking.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  const publishedRoutes = getPublishedMarketingRoutes()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <NavbarV3 publishedRoutes={publishedRoutes} />
      <main className="flex-1">{children}</main>
      <FooterV3 publishedRoutes={publishedRoutes} />
    </div>
  )
}
