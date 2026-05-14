'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Cookie,
  FileSignature,
  FileText,
  ListTree,
  Mail,
  Printer,
  ShieldCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { LEGAL_DOCS, type LegalDocSlug } from './legal-doc-registry'
import { useConsent } from '@/components/providers/consent-provider'

const ICONS: Record<LegalDocSlug, LucideIcon> = {
  villkor: FileText,
  integritetspolicy: ShieldCheck,
  cookiepolicy: Cookie,
  personuppgiftsbitradesavtal: FileSignature,
  underbitraden: ListTree,
}

export function LegalSidebar() {
  const { openSettings } = useConsent()
  const pathname = usePathname()

  return (
    <aside className="legal-sidebar print-hide">
      <div className="legal-sidebar-sticky">
        <div className="legal-sidebar-heading">Dokument</div>
        <nav className="legal-sidebar-nav">
          {LEGAL_DOCS.map((doc) => {
            const Icon = ICONS[doc.slug]
            const href = `/${doc.slug}`
            const active = pathname === href
            return (
              <Link
                key={doc.slug}
                href={href}
                className="legal-nav-item"
                data-active={active}
              >
                <span className="legal-nav-icon">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="legal-nav-title">{doc.title}</span>
                  <span className="legal-nav-slug">/{doc.slug}</span>
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="legal-sidebar-divider" />

        <button type="button" className="legal-nav-item" onClick={openSettings}>
          <span className="legal-nav-icon">
            <Cookie className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="legal-nav-title">Cookieinställningar</span>
            <span className="legal-nav-helper">
              Ändra eller återkalla samtycke
            </span>
          </span>
        </button>

        <a href="mailto:dev@laglig.se" className="legal-nav-item">
          <span className="legal-nav-icon">
            <Mail className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="legal-nav-title">Dataskyddskontakt</span>
            <span className="legal-nav-helper">dev@laglig.se</span>
          </span>
        </a>

        <button
          type="button"
          className="legal-nav-item"
          onClick={() => window.print()}
        >
          <span className="legal-nav-icon">
            <Printer className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="legal-nav-title">Skriv ut / Spara PDF</span>
            <span className="legal-nav-helper">Aktuell sida</span>
          </span>
        </button>
      </div>
    </aside>
  )
}
