import { PricingSection } from '@/components/features/landing/pricing-section'
import { BrowsePagesPrefetcher } from '@/components/features/landing/browse-pages-prefetcher'

import { NavbarV3 } from '@/components/features/landing-v3/navbar-v3'
import { FooterV3 } from '@/components/features/landing-v3/footer-v3'
import { ForceLightTheme } from '@/components/features/landing-v2/force-light-theme'
import { getPublishedMarketingRoutes } from '@/lib/marketing/content'

import { HeroV3 } from '@/components/features/landing-v3/hero-v3'
import { WhySectionGraph as WhySection } from '@/components/features/landing-v3/why-section-graph'
import { FeatureShowcase } from '@/components/features/landing-v3/feature-showcase'
import { ScaleSection } from '@/components/features/landing-v3/scale-section'
import { KnowledgeGraphSection } from '@/components/features/landing-v3/knowledge-graph-section'
import { AiComparisonSection } from '@/components/features/landing-v3/ai-comparison-section'
import { AiSectionBackdrop } from '@/components/features/landing-v3/ai-section-backdrop'
import { OpenDatabaseV3 } from '@/components/features/landing-v3/open-database-v3'
import { InfrastructureSection } from '@/components/features/landing-v3/infrastructure-section'
import { ByraerSection } from '@/components/features/landing-v3/byraer-section'
import { TryNowSection } from '@/components/features/landing-v3/try-now-section'
import { FaqV3 } from '@/components/features/landing-v3/faq-v3'
import { CtaV3 } from '@/components/features/landing-v3/cta-v3'

// Promoted from /landing-v3 → / on 2026-06-06. Replaces the previous landing
// (HeroSection / LogoCloud / Risk / Features / HowItWorks / Testimonials /
// Compliance / Faq / Cta from `components/features/landing/`). The v2 patch
// prototype remains archived at /landing-v2 for reference.
export const metadata = {
  // `absolute` bypasses the root layout's `'%s | Laglig.se'` title template
  // so we don't get the duplicated "Laglig.se ... | Laglig.se" suffix in SERPs.
  title: {
    absolute: 'Lagbevakning & lagefterlevnad med AI | Laglig.se',
  },
  // ~150 chars — full message lands in Google SERPs (truncation cap ~155).
  description:
    'Laglig bevakar lagändringar, håller er laglista uppdaterad och samlar bevis för revisionen. AI-grundad i svensk rätt, inga konsultarvoden.',
}

export default function Home() {
  // Story 26.2: live marketing pages light up their nav/footer items;
  // unpublished ones fall back to anchors (Produkt) or "Kommer snart".
  const publishedRoutes = getPublishedMarketingRoutes()

  return (
    <>
      <ForceLightTheme />

      <NavbarV3 publishedRoutes={publishedRoutes} />
      <main>
        <HeroV3 />
        {/* Problem → Solution: the scale/"vem har koll" problem hands straight
            into the product showcase (the Breadth text cards folded into the
            showcase tabs, removing the duplication). */}
        <WhySection />
        <FeatureShowcase />
        {/* AI chapter — comparison (the claim) + knowledge graph (the proof),
            one continuous dark banner over a single faint graph texture */}
        <div
          id="ai"
          className="relative isolate scroll-mt-16 overflow-hidden bg-foreground text-background"
        >
          <AiSectionBackdrop />
          <div className="pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-96 w-96 rounded-full bg-background/[0.04] blur-3xl" />
          <AiComparisonSection />
          <KnowledgeGraphSection />
        </div>
        <ScaleSection />
        <OpenDatabaseV3 />
        <InfrastructureSection />
        <ByraerSection />
        <TryNowSection />
        <PricingSection />
        <FaqV3 />
        <CtaV3 />
      </main>
      <FooterV3 publishedRoutes={publishedRoutes} />
      <BrowsePagesPrefetcher />
    </>
  )
}
