'use client'

/**
 * Styrdokument showcase body — the frozen `MarketingDocumentTable` (28.4),
 * under a page header that mirrors `/workspace/styrdokument`. Presentational
 * only; `pointer-events-none` makes it a static, live-looking screenshot.
 */
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { MarketingDocumentTable } from './marketing-document-table'
import { DOCUMENTS } from './styrdokument-mock-data'
import { noop } from './showcase-utils'

export function StyrdokumentReal() {
  return (
    <div className="pointer-events-none select-none space-y-6 bg-background px-10 py-9 text-left">
      <PageHeader
        title="Styrdokument"
        subtitle="Policyer, rutiner och riskbedömningar — versionshanterade och kopplade till era krav."
        primaryAction={
          <Button>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Nytt dokument
          </Button>
        }
      />
      <MarketingDocumentTable
        documents={DOCUMENTS}
        sortBy="updated_at"
        sortOrder="desc"
        onSort={noop}
        onArchive={noop}
      />
    </div>
  )
}
