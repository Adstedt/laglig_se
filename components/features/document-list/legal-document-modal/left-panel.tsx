'use client'

/**
 * Story 6.3: Left Panel
 * Scrollable panel with law header, lagtext, business context, and activity tabs
 */

import { Accordion } from '@/components/ui/accordion'
import { LawHeader } from './law-header'
import { LagtextSection } from './lagtext-section'
import { BusinessContext } from './business-context'
import { ActivityTabs } from './activity-tabs'
import type { ListItemDetails } from '@/app/actions/legal-document-modal'

interface LeftPanelProps {
  listItem: ListItemDetails
  isLoadingContent?: boolean
}

export function LeftPanel({ listItem, isLoadingContent }: LeftPanelProps) {
  return (
    <div className="p-6 space-y-4">
      {/* Law Header */}
      <LawHeader
        title={listItem.legalDocument.title}
        aiCommentary={listItem.aiCommentary}
      />

      {/* Lagtext and Business Context Accordions */}
      <Accordion
        type="multiple"
        defaultValue={['business-context']}
        className="space-y-2"
      >
        {/* Lagtext Section */}
        <LagtextSection
          documentId={listItem.legalDocument.id}
          htmlContent={listItem.legalDocument.htmlContent}
          fullText={null}
          slug={listItem.legalDocument.slug}
          sourceUrl={listItem.legalDocument.sourceUrl}
          isLoading={isLoadingContent || false}
        />

        {/* Business Context */}
        <BusinessContext
          listItemId={listItem.id}
          initialContent={listItem.businessContext}
        />
      </Accordion>

      {/* Activity Tabs */}
      <ActivityTabs listItemId={listItem.id} />
    </div>
  )
}
