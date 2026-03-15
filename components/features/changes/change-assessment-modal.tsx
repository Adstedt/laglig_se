'use client'

/**
 * Story 14.10: Change Assessment Modal
 * Opens when clicking a change row in the Changes tab.
 * Contains ChatPanel with contextType='change' and AssessmentResolution footer.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ChatPanel } from '@/components/features/ai-chat/chat-panel'
import { cn } from '@/lib/utils'
import type { UnacknowledgedChange } from '@/lib/changes/change-utils'
import type { ChangeType } from '@prisma/client'

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  AMENDMENT: 'Ändring',
  REPEAL: 'Upphävande',
  NEW_LAW: 'Ny lag',
  METADATA_UPDATE: 'Metadata',
  NEW_RULING: 'Nytt avgörande',
}

const AUTO_START_MESSAGE =
  'Granska denna lagändring och bedöm hur den påverkar vår verksamhet.'

interface ChangeAssessmentModalProps {
  change: UnacknowledgedChange | null
  onClose: () => void
}

export function ChangeAssessmentModal({
  change,
  onClose,
}: ChangeAssessmentModalProps) {
  const isOpen = change !== null

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/30',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed top-[50%] left-[50%] z-50',
            'translate-x-[-50%] translate-y-[-50%]',
            'w-full max-h-[90vh] max-w-[840px] p-0 gap-0',
            'bg-background border shadow-lg rounded-lg overflow-hidden',
            'focus:outline-none focus-visible:outline-none',
            'max-md:max-w-[95vw]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'duration-200'
          )}
          onEscapeKeyDown={onClose}
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">
            {change ? `Granska ändring: ${change.documentTitle}` : 'Laddar...'}
          </DialogTitle>

          {change && (
            <div className="flex flex-col h-[90vh] max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
                <Badge variant="default">
                  {CHANGE_TYPE_LABELS[change.changeType]}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {change.documentTitle}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {change.documentNumber}
                  </p>
                </div>
              </div>

              {/* Chat + Assessment */}
              <ChatPanel
                contextType="change"
                contextId={change.id}
                lawListItemId={change.lawListItemId}
                analyticsLocation="law_modal"
                onClose={onClose}
                showHeader={false}
                initialMessage={AUTO_START_MESSAGE}
                className="flex-1 min-h-0"
              />
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
