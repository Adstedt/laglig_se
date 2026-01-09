'use client'

/**
 * Story 6.5: Column Add Dialog
 * Dialog for creating a new task column with name and optional color.
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ColumnColorPicker } from './column-color-picker'

interface ColumnAddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (name: string, color: string) => void
  isCreating?: boolean
}

const DEFAULT_COLOR = '#6b7280'

export function ColumnAddDialog({
  open,
  onOpenChange,
  onConfirm,
  isCreating = false,
}: ColumnAddDialogProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Kolumnnamn krävs')
      return
    }
    if (trimmedName.length > 50) {
      setError('Max 50 tecken')
      return
    }

    onConfirm(trimmedName, color)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form on close
      setName('')
      setColor(DEFAULT_COLOR)
      setError(null)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Ny kolumn</DialogTitle>
            <DialogDescription>
              Skapa en ny kolumn i din Kanban-tavla.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="column-name">Kolumnnamn</Label>
              <Input
                id="column-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError(null)
                }}
                placeholder="T.ex. Granskning"
                maxLength={50}
                disabled={isCreating}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="grid gap-2">
              <Label>Färg</Label>
              <div className="flex items-center gap-2">
                <ColumnColorPicker
                  color={color}
                  onColorChange={setColor}
                  disabled={isCreating}
                />
                <span className="text-sm text-muted-foreground">
                  Välj en färg för kolumnhuvudet
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={isCreating || !name.trim()}>
              {isCreating ? 'Skapar...' : 'Skapa kolumn'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
