import { Navbar } from '@/components/shared/navigation/navbar'
import { Footer } from '@/components/shared/navigation/footer'
import { HeroSection } from '@/components/features/landing/hero-section'
import { LogoCloudSection } from '@/components/features/landing/logo-cloud-section'
import { RiskSection } from '@/components/features/landing/risk-section'
import { FeaturesSection } from '@/components/features/landing/features-section'
import { HowItWorksSection } from '@/components/features/landing/how-it-works-section'
import { TestimonialsSection } from '@/components/features/landing/testimonials-section'
import { ComplianceSection } from '@/components/features/landing/compliance-section'
import { PricingSection } from '@/components/features/landing/pricing-section'
import { FaqSection } from '@/components/features/landing/faq-section'
import { CtaSection } from '@/components/features/landing/cta-section'

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <LogoCloudSection />
        <RiskSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <ComplianceSection />
        <PricingSection />
        <FaqSection />
        <CtaSection />
      </main>
      <Footer />
    </>
  )
}
