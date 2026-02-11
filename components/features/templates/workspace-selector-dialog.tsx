'use client'

/**
 * Story 12.10: Workspace Selector Dialog
 * Shown when a user with multiple workspaces clicks "Använd denna mall".
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export interface UserWorkspace {
  id: string
  name: string
  slug: string
}

interface WorkspaceSelectorDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  workspaces: UserWorkspace[]
  currentWorkspaceId: string
  onConfirm: (_workspaceId: string) => void
}

export function WorkspaceSelectorDialog({
  open,
  onOpenChange,
  workspaces,
  currentWorkspaceId,
  onConfirm,
}: WorkspaceSelectorDialogProps) {
  const [selectedId, setSelectedId] = useState(currentWorkspaceId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Välj arbetsyta</DialogTitle>
          <DialogDescription>
            Välj vilken arbetsyta mallen ska läggas till i.
          </DialogDescription>
        </DialogHeader>

        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger>
            <SelectValue placeholder="Välj arbetsyta" />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((ws) => (
              <SelectItem key={ws.id} value={ws.id}>
                {ws.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={() => onConfirm(selectedId)}>Bekräfta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
