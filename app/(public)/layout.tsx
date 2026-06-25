import { ForceLightTheme } from '@/components/features/landing-v3/force-light-theme'
import { MarketingShell } from '@/components/marketing/templates/marketing-shell'

interface PublicLayoutProps {
  children: React.ReactNode
}

/**
 * Chrome for the public content pages — /lagar, /eu, /sok, /rattskallor, the
 * law-reading pages and the legal pages.
 *
 * Renders the same landing-v3 chrome (NavbarV3 + FooterV3) as the marketing
 * pages via MarketingShell, so the header/footer are identical across every
 * public surface — these pages are reached straight from the marketing navbar,
 * so a separate older navbar (with its own "Bläddra alla" Regelverk dropdown)
 * read as a different site. ForceLightTheme matches the light-only v3 chrome,
 * same as app/(marketing)/layout.tsx and the homepage.
 */
export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <>
      <ForceLightTheme />
      <MarketingShell>{children}</MarketingShell>
    </>
  )
}
