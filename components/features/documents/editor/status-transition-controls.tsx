'use client'

import { useCallback, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  MoreHorizontal,
  Send,
  CheckCircle2,
  FilePlus,
  Archive,
  Undo2,
  ArrowRightLeft,
} from 'lucide-react'
import { updateDocumentStatus } from '@/app/actions/documents'
import { STATUS_CONFIG } from '@/components/features/documents/document-status-badge'
import { WorkspaceDocumentStatus } from '@prisma/client'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Config: maps each status to its primary action + overflow actions
// ---------------------------------------------------------------------------

interface PrimaryActionConfig {
  targetStatus?: WorkspaceDocumentStatus
  label: string
  loadingLabel: string
  variant: 'default' | 'outline'
  className?: string
  icon: React.ElementType
  isCreateDraft?: boolean
}

interface OverflowActionConfig {
  targetStatus: WorkspaceDocumentStatus
  label: string
  icon: React.ElementType
}

interface SecondaryActionConfig {
  targetStatus: WorkspaceDocumentStatus
  label: string
  icon: React.ElementType
}

const STATUS_ACTION_CONFIG: Partial<
  Record<
    WorkspaceDocumentStatus,
    {
      primary?: PrimaryActionConfig | undefined
      secondary?: SecondaryActionConfig | undefined
      overflow: OverflowActionConfig[]
    }
  >
> = {
  DRAFT: {
    primary: {
      targetStatus: WorkspaceDocumentStatus.IN_REVIEW,
      label: 'Skicka till granskning',
      loadingLabel: 'Skickar...',
      variant: 'default',
      icon: Send,
    },
    overflow: [
      {
        targetStatus: WorkspaceDocumentStatus.ARCHIVED,
        label: 'Arkivera',
        icon: Archive,
      },
    ],
  },
  IN_REVIEW: {
    primary: {
      targetStatus: WorkspaceDocumentStatus.APPROVED,
      label: 'Godkänn',
      loadingLabel: 'Godkänner...',
      variant: 'default',
      className: 'bg-green-600 hover:bg-green-700 text-white',
      icon: CheckCircle2,
    },
    secondary: {
      targetStatus: WorkspaceDocumentStatus.DRAFT,
      label: 'Neka',
      icon: Undo2,
    },
    overflow: [],
  },
  APPROVED: {
    primary: {
      label: 'Skapa ny version',
      loadingLabel: 'Skapar...',
      variant: 'outline',
      icon: FilePlus,
      isCreateDraft: true,
    },
    overflow: [
      {
        targetStatus: WorkspaceDocumentStatus.SUPERSEDED,
        label: 'Ersätt',
        icon: ArrowRightLeft,
      },
      {
        targetStatus: WorkspaceDocumentStatus.ARCHIVED,
        label: 'Arkivera',
        icon: Archive,
      },
    ],
  },
  SUPERSEDED: {
    primary: undefined,
    overflow: [
      {
        targetStatus: WorkspaceDocumentStatus.ARCHIVED,
        label: 'Arkivera',
        icon: Archive,
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StatusTransitionControlsProps {
  documentId: string
  currentStatus: string
  onStatusChange: (_newStatus?: string) => void
  onCreateDraft?: () => Promise<void>
  creatingDraft?: boolean
  // Story 17.17 smoke-found coordination fix — when a draft pointer is set,
  // the APPROVED config's "Skapa ny version" primary action is suppressed
  // (calling createDraftFromApproved against a doc that already has a draft
  // would refuse with Story 17.16's "Ett utkast pågår redan…" error). The
  // new Skicka/Förkasta/Godkänn buttons in DocumentEditor's metadata bar
  // handle the dual-state workflow instead. Overflow actions (Ersätt,
  // Arkivera) stay visible — they remain valid for dual-state docs.
  currentDraftVersionId?: string | null
}

export function StatusTransitionControls({
  documentId,
  currentStatus,
  onStatusChange,
  onCreateDraft,
  creatingDraft,
  currentDraftVersionId = null,
}: StatusTransitionControlsProps) {
  const [pendingStatus, setPendingStatus] =
    useState<WorkspaceDocumentStatus | null>(null)
  const [comment, setComment] = useState('')
  const [updating, setUpdating] = useState(false)

  const rawConfig =
    STATUS_ACTION_CONFIG[currentStatus as WorkspaceDocumentStatus]

  // Story 17.17 — suppress the primary action when a draft is already in
  // progress. APPROVED + draft pending: the dual-state metadata-bar buttons
  // (Skicka / Godkänn / Förkasta) cover what "Skapa ny version" would have
  // done. Legacy DRAFT + draft pending (pre-17.16 createDraftFromApproved
  // legacy state): the metadata-bar "Skicka för granskning" supersedes the
  // legacy primary too, so suppress it consistently.
  const config =
    rawConfig != null && currentDraftVersionId != null
      ? { ...rawConfig, primary: undefined }
      : rawConfig

  const handleConfirm = useCallback(async () => {
    if (!pendingStatus) return
    setUpdating(true)
    const result = await updateDocumentStatus({
      documentId,
      newStatus: pendingStatus,
      comment: comment.trim() || undefined,
    })
    setUpdating(false)
    setPendingStatus(null)
    setComment('')
    if (result.success) {
      onStatusChange(pendingStatus)
    }
  }, [documentId, pendingStatus, comment, onStatusChange])

  const handlePrimaryClick = useCallback(() => {
    if (!config?.primary) return

    if (config.primary.isCreateDraft && onCreateDraft) {
      onCreateDraft()
      return
    }

    if (config.primary.targetStatus) {
      setPendingStatus(config.primary.targetStatus)
    }
  }, [config, onCreateDraft])

  // Nothing to show for ARCHIVED or unknown statuses
  if (
    !config ||
    (!config.primary && !config.secondary && config.overflow.length === 0)
  ) {
    return null
  }

  const pendingLabel = pendingStatus ? STATUS_CONFIG[pendingStatus]?.label : ''
  const primaryLoading = config.primary?.isCreateDraft
    ? creatingDraft
    : updating

  return (
    <>
      <div className="flex items-center gap-1">
        {/* Primary action button */}
        {config.primary && (
          <Button
            size="sm"
            variant={config.primary.variant}
            className={cn(config.primary.className)}
            onClick={handlePrimaryClick}
            disabled={primaryLoading}
          >
            <config.primary.icon className="mr-1 h-4 w-4" />
            {primaryLoading
              ? config.primary.loadingLabel
              : config.primary.label}
          </Button>
        )}

        {/* Secondary action button (visible, not in overflow) */}
        {config.secondary && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPendingStatus(config.secondary!.targetStatus)}
            disabled={updating}
          >
            <config.secondary.icon className="mr-1 h-4 w-4" />
            {config.secondary.label}
          </Button>
        )}

        {/* Overflow menu for tertiary actions */}
        {config.overflow.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {config.overflow.map((action) => {
                const Icon = action.icon
                return (
                  <DropdownMenuItem
                    key={action.targetStatus}
                    onClick={() => setPendingStatus(action.targetStatus)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {action.label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Confirmation dialog — shared by primary + overflow status transitions */}
      <AlertDialog
        open={!!pendingStatus}
        onOpenChange={(open) => {
          if (!open) {
            setPendingStatus(null)
            setComment('')
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ändra status</AlertDialogTitle>
            <AlertDialogDescription>
              Ändra status till &quot;{pendingLabel}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <span className="text-sm text-muted-foreground mb-1 block">
              Kommentar (valfritt)
            </span>
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Anledning till ändringen..."
              maxLength={500}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={updating}>
              {updating ? 'Ändrar...' : 'Bekräfta'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
