'use client'

/**
 * Story 7.5: HR-area mount — a small dialog wrapping the SAME upload form the
 * Settings tab uses (`create-document-dialog` structure, form-only; no split
 * panels). Opened from the Personalkort's kollektivavtal empty state.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CollectiveAgreementListItem } from '@/app/actions/collective-agreements'
import { KollektivavtalUploadForm } from './kollektivavtal-upload-form'

export interface KollektivavtalUploadDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  onUploaded: (_agreement: CollectiveAgreementListItem) => void
}

export function KollektivavtalUploadDialog({
  open,
  onOpenChange,
  onUploaded,
}: KollektivavtalUploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ladda upp kollektivavtal</DialogTitle>
          <DialogDescription>
            Avtalet blir valbart för anställda och sökbart för AI-assistenten
            när bearbetningen är klar.
          </DialogDescription>
        </DialogHeader>
        <KollektivavtalUploadForm
          onUploaded={(agreement) => {
            onUploaded(agreement)
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
