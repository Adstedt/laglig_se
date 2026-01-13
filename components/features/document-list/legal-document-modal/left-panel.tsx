'use client'

/**
 * Story 6.3: Left Panel
 * Scrollable panel with law header, lagtext, business context, and activity tabs
 */

import { LawHeader } from './law-header'
import { LagtextSection } from './lagtext-section'
import { BusinessContext } from './business-context'
import { ActivityTabs } from './activity-tabs'
import type { ListItemDetails } from '@/app/actions/legal-document-modal'

interface LeftPanelProps {
  listItem: ListItemDetails
}

export function LeftPanel({ listItem }: LeftPanelProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Law Header */}
      <LawHeader
        title={listItem.legalDocument.title}
        aiCommentary={listItem.aiCommentary}
      />

      {/* Lagtext Section */}
      <LagtextSection
        documentId={listItem.legalDocument.id}
        htmlContent={listItem.legalDocument.htmlContent}
        fullText={listItem.legalDocument.fullText}
        slug={listItem.legalDocument.slug}
        sourceUrl={listItem.legalDocument.sourceUrl}
      />

      {/* Business Context */}
      <BusinessContext
        listItemId={listItem.id}
        initialContent={listItem.businessContext}
      />

      {/* Activity Tabs */}
      <ActivityTabs listItemId={listItem.id} />
    </div>
  )
}
