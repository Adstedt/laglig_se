'use client'

/**
 * Epic 21 Story 21.16 — Cycle Item Modal.
 *
 * Split-panel modal for a ComplianceAuditItem (a materialised row in a
 * kontroll cycle). Opens on row-click in the Items tab, and deep-links via
 * `?item=<id>&finding=<id>` query params on the cycle detail page.
 *
 * Composition over `SplitPanelModal` — same shell pattern as
 * `legal-document-modal` and `task-modal`. State flow:
 *   - `item` + `findings` + `readOnly` passed in from the parent (cycle-detail-page);
 *     the modal does NOT fetch its own data.
 *   - Mutation callbacks (`onBedomningChange`, `onMotiveringChange`, `onSign`,
 *     `onUnsign`, `onFindingMutation`) are the same handlers used by the
 *     Items tab's inline cells — the modal reuses them for the right-panel
 *     actions so optimistic UI + toast-recovery stays centralised.
 *   - Finding editor state (create/edit) is local — opened from the left-panel
 *     FindingCard clicks or the "Lägg till finding" button.
 */

import { useState } from 'react'
import { FindingEditor } from '@/components/features/compliance-audit/finding-editor'
import { AiChatPanel } from '@/components/features/document-list/legal-document-modal/ai-chat-panel'
import { SplitPanelModal } from '@/components/shared/split-panel-modal'
import { CycleItemModalHeader } from './modal-header'
import { CycleItemModalLeftPanel } from './left-panel'
import { CycleItemModalRightPanel } from './right-panel'
import { CycleItemRightPanelRail } from './right-panel-rail'
import { CompactItemStrip } from './compact-item-strip'
import type { CycleItemRow } from '@/app/actions/compliance-audit-item'
import type { FindingRow } from '@/app/actions/compliance-finding'
import type { EfterlevnadsBedomning } from '@prisma/client'

interface CycleItemModalProps {
  /** The item to render. When null, modal is closed. */
  item: CycleItemRow | null
  /** Full findings array from the parent — filtered inside the modal. */
  findings: FindingRow[]
  /** All items in the cycle — threaded through to the FindingEditor's
   *  lawListItemId picker (create mode). */
  items: CycleItemRow[]
  cycleId: string
  cycleName: string
  readOnly: boolean
  /** Scroll + briefly highlight the matching finding card on open. */
  focusFindingId: string | null
  /** Close the modal (clears selectedItemId + focusFindingId in the parent). */
  onClose: () => void
  onBedomningChange: (
    _row: CycleItemRow,
    _next: EfterlevnadsBedomning | null
  ) => Promise<void>
  onMotiveringChange: (
    _row: CycleItemRow,
    _next: string | null
  ) => Promise<void>
  onSign: (_row: CycleItemRow) => Promise<void>
  onUnsign: (_row: CycleItemRow) => Promise<void>
  onFindingMutation: (_finding: FindingRow) => void
}

export function CycleItemModal({
  item,
  findings,
  items,
  cycleId,
  cycleName,
  readOnly,
  focusFindingId,
  onClose,
  onBedomningChange,
  onMotiveringChange,
  onSign,
  onUnsign,
  onFindingMutation,
}: CycleItemModalProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingFinding, setEditingFinding] = useState<FindingRow | null>(null)

  const isOpen = item !== null

  const itemFindings = item
    ? findings.filter((f) => f.lawListItemId === item.lawListItemId)
    : []

  const handleEditFinding = (finding: FindingRow) => {
    setEditingFinding(finding)
    setEditorOpen(true)
  }

  const handleAddFinding = () => {
    setEditingFinding(null)
    setEditorOpen(true)
  }

  return (
    <>
      <SplitPanelModal
        open={isOpen}
        onClose={onClose}
        srTitle={item?.lawTitle ?? 'Laddar...'}
        header={
          item ? (
            <CycleItemModalHeader
              cycleName={cycleName}
              lawDocumentNumber={item.lawDocumentNumber}
              lawSlug={null}
              onClose={onClose}
            />
          ) : null
        }
        leftPanel={
          item ? (
            <CycleItemModalLeftPanel
              item={item}
              findings={itemFindings}
              focusFindingId={focusFindingId}
              readOnly={readOnly}
              onEditFinding={handleEditFinding}
              onAddFinding={handleAddFinding}
            />
          ) : null
        }
        rightPanel={
          item ? (
            <CycleItemModalRightPanel
              item={item}
              findings={itemFindings}
              readOnly={readOnly}
              onBedomningChange={(next) => onBedomningChange(item, next)}
              onMotiveringChange={(next) => onMotiveringChange(item, next)}
              onSign={() => onSign(item)}
              onUnsign={() => onUnsign(item)}
            />
          ) : null
        }
        renderRail={
          item
            ? ({ onExpandRail }) => (
                <CycleItemRightPanelRail
                  item={item}
                  findings={itemFindings}
                  onExpandRail={onExpandRail}
                />
              )
            : undefined
        }
        renderChat={
          item
            ? ({ expanded, onToggleExpand, onClose: closeChat }) => (
                <AiChatPanel
                  documentTitle={item.lawTitle}
                  documentNumber={item.lawDocumentNumber}
                  listItemId={item.lawListItemId}
                  expanded={expanded}
                  onToggleExpand={onToggleExpand}
                  onClose={closeChat}
                />
              )
            : undefined
        }
        expandedHeader={item ? <CompactItemStrip item={item} /> : undefined}
      />

      {item ? (
        <FindingEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          cycleId={cycleId}
          mode={editingFinding ? 'edit' : 'create'}
          {...(editingFinding ? { finding: editingFinding } : {})}
          items={items}
          {...(editingFinding
            ? {}
            : { prefillLawListItemId: item.lawListItemId })}
          onSuccess={onFindingMutation}
        />
      ) : null}
    </>
  )
}
