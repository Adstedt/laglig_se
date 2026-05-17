import Link from 'next/link'
import { Footer } from '@/components/shared/navigation/footer'
import { PricingSection } from '@/components/features/landing/pricing-section'
import { FaqSection } from '@/components/features/landing/faq-section'
import { BrowsePagesPrefetcher } from '@/components/features/landing/browse-pages-prefetcher'

import { NavbarV2 } from '@/components/features/landing-v2/navbar-v2'
import { ForceLightTheme } from '@/components/features/landing-v2/force-light-theme'

import { HeroV3 } from '@/components/features/landing-v3/hero-v3'
import { WhySection } from '@/components/features/landing-v3/why-section'
import { BreadthSection } from '@/components/features/landing-v3/breadth-section'
import { RolesSection } from '@/components/features/landing-v3/roles-section'
import { AiAgentSection } from '@/components/features/landing-v3/ai-agent-section'
import { OpenDatabaseV3 } from '@/components/features/landing-v3/open-database-v3'
import { InfrastructureSection } from '@/components/features/landing-v3/infrastructure-section'
import { ByraerSection } from '@/components/features/landing-v3/byraer-section'
import { CtaV3 } from '@/components/features/landing-v3/cta-v3'

export const metadata = {
  title: 'Laglig.se – v3 wireframe (Fortnox-positioning)',
  robots: { index: false, follow: false },
}

export default function LandingV3Page() {
  return (
    <>
      <ForceLightTheme />

      <div className="sticky top-0 z-[60] w-full border-b border-amber-200 bg-amber-100/95 px-4 py-1.5 text-center text-xs font-medium text-amber-900 backdrop-blur">
        Wireframe v3 · Fortnox-for-compliance positioning · structure + copy
        only, polish not invested · live page is at{' '}
        <Link href="/" className="underline">
          /
        </Link>{' '}
        · patch prototype is at{' '}
        <Link href="/landing-v2" className="underline">
          /landing-v2
        </Link>
      </div>

      <NavbarV2 />
      <main>
        <HeroV3 />
        <WhySection />
        <BreadthSection />
        <AiAgentSection />
        <RolesSection />
        <OpenDatabaseV3 />
        <InfrastructureSection />
        <ByraerSection />
        <PricingSection />
        <FaqSection />
        <CtaV3 />
      </main>
      <Footer />
      <BrowsePagesPrefetcher />
    </>
  )
}
