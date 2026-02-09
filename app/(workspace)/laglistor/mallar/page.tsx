/**
 * Story 12.8: Template Catalog Browse Page
 * Authenticated route: /laglistor/mallar
 */

import { Metadata } from 'next'
import {
  getPublishedTemplates,
  getUniqueDomains,
} from '@/lib/db/queries/template-catalog'
import { TemplateCatalogClient } from '@/components/features/templates/template-catalog-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Mallbibliotek | Laglig',
  description:
    'Utforska färdiga laglistor och hitta en relevant utgångspunkt för ditt efterlevnadsarbete.',
}

export default async function TemplateCatalogPage() {
  const [templates, domains] = await Promise.all([
    getPublishedTemplates(),
    getUniqueDomains(),
  ])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold">Mallbibliotek</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Utforska färdiga laglistor och hitta en relevant utgångspunkt för ditt
          efterlevnadsarbete.
        </p>
      </div>

      <TemplateCatalogClient templates={templates} domains={domains} />
    </div>
  )
}
