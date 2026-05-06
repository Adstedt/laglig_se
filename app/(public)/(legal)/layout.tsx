import Link from 'next/link'
import { ChevronRight, Scale } from 'lucide-react'

import { LegalSidebar } from '@/components/features/legal/legal-sidebar'
import { ScrollToTopOnNav } from '@/components/features/legal/scroll-to-top-on-nav'

import './legal.css'

// "Juridiskt & dataskydd" is the section root. Clicking it (in either the
// breadcrumb or hero eyebrow) takes you to /villkor — the canonical entry
// point for the legal section.
const SECTION_ROOT = '/villkor'

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <ScrollToTopOnNav />

      <div className="legal-breadcrumb print-hide">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-6 py-3 text-xs text-stone-500">
          <Link href="/" className="hover:text-stone-800">
            Hem
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link
            href={SECTION_ROOT}
            className="text-stone-700 hover:text-stone-900"
          >
            Juridiskt &amp; dataskydd
          </Link>
        </div>
      </div>

      <section className="legal-hero print-hide">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <Link
            href={SECTION_ROOT}
            className="legal-hero-eyebrow legal-hero-eyebrow-link"
          >
            <Scale className="h-3.5 w-3.5" />
            Juridiskt &amp; dataskydd
          </Link>
          <h1 className="legal-hero-title">
            Avtal, integritet, säkerhet
            <br />
            <span className="muted">— samlat och granskningsbart.</span>
          </h1>
          <p className="legal-hero-subtitle">
            Allt du behöver för att granska Laglig.se som leverantör: våra
            villkor, hur vi behandlar personuppgifter, vilka underbiträden vi
            använder och hur PuB-avtalet ser ut.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-10 md:grid-cols-[260px_1fr] md:py-12">
        <LegalSidebar />
        {children}
      </div>
    </>
  )
}
