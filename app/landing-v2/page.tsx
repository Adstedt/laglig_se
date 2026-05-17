import Link from 'next/link'
import { ForceLightTheme } from '@/components/features/landing-v2/force-light-theme'
import { Footer } from '@/components/shared/navigation/footer'
import { LogoCloudSection } from '@/components/features/landing/logo-cloud-section'
import { HowItWorksSection } from '@/components/features/landing/how-it-works-section'
import { PricingSection } from '@/components/features/landing/pricing-section'
import { FaqSection } from '@/components/features/landing/faq-section'
import { CtaSection } from '@/components/features/landing/cta-section'
import { BrowsePagesPrefetcher } from '@/components/features/landing/browse-pages-prefetcher'

import { NavbarV2 } from '@/components/features/landing-v2/navbar-v2'
import { HeroSectionV2 } from '@/components/features/landing-v2/hero-section-v2'
import { RiskSectionV2 } from '@/components/features/landing-v2/risk-section-v2'
import { FeaturesSectionV2 } from '@/components/features/landing-v2/features-section-v2'
import { ComplianceSectionV2 } from '@/components/features/landing-v2/compliance-section-v2'
import { FreeDatabaseSection } from '@/components/features/landing-v2/free-database-section'

export const metadata = {
  title: 'Laglig.se – prototype (post-audit fixes)',
  robots: { index: false, follow: false },
}

export default function LandingV2Page() {
  return (
    <>
      <ForceLightTheme />
      {/* Prototype banner — visible reminder this is NOT the live landing */}
      <div className="sticky top-0 z-[60] w-full border-b border-amber-200 bg-amber-100/95 px-4 py-1.5 text-center text-xs font-medium text-amber-900 backdrop-blur dark:border-amber-800 dark:bg-amber-950/90 dark:text-amber-200">
        Prototype · post-audit fixes · not live · live page is at{' '}
        <Link href="/" className="underline">
          /
        </Link>
      </div>

      <NavbarV2 />
      <main>
        <HeroSectionV2 />
        <LogoCloudSection />
        <RiskSectionV2 />
        <FeaturesSectionV2 />
        <HowItWorksSection />
        <ComplianceSectionV2 />
        {/* NEW section — promotes the free corpus (SEO + lead-gen) */}
        <FreeDatabaseSection />
        <PricingSection />
        <FaqSection />
        {/* Testimonials section intentionally removed pending real customers */}
        <CtaSection />
      </main>
      <Footer />
      <BrowsePagesPrefetcher />
    </>
  )
}
