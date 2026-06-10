import { ForceLightTheme } from '@/components/features/landing-v2/force-light-theme'

/**
 * Route-group layout for /funktioner, /branscher, /omraden (Story 26.1).
 *
 * Forces light theme to match the homepage (the landing-v3 chrome is
 * light-only). The MarketingShell itself (NavbarV3 + breadcrumbs + FooterV3)
 * is rendered by the page templates, which own the per-page breadcrumb data.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <ForceLightTheme />
      {children}
    </>
  )
}
