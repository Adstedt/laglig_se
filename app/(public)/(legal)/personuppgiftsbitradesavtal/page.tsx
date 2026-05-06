import type { Metadata } from 'next'

import { LegalDoc } from '@/components/features/legal/legal-doc'
import { getLegalDoc } from '@/components/features/legal/legal-doc-registry'

const doc = getLegalDoc('personuppgiftsbitradesavtal')

export const metadata: Metadata = {
  title: `${doc.title} — Laglig.se`,
  description: doc.subtitle,
  alternates: { canonical: `/${doc.slug}` },
  robots: { index: true, follow: true },
}

export default function Page() {
  return <LegalDoc slug="personuppgiftsbitradesavtal" />
}
