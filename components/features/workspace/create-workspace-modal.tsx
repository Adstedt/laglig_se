'use client'

/**
 * Story 5.9: Create Workspace Modal
 * Simple modal for creating a new workspace with just a name field.
 * New workspaces start as TRIAL tier.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Loader2 } from 'lucide-react'
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
import { createWorkspace } from '@/app/actions/workspace'
import { useWorkspace } from '@/lib/hooks/use-workspace'

// Validation schema
const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Arbetsplatsnamn krävs').max(100, 'Max 100 tecken'),
})

type CreateWorkspaceForm = z.infer<typeof createWorkspaceSchema>

interface CreateWorkspaceModalProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
}

export function CreateWorkspaceModal({
  open,
  onOpenChange,
}: CreateWorkspaceModalProps) {
  const router = useRouter()
  const { refresh } = useWorkspace()
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateWorkspaceForm>({
    resolver: zodResolver(createWorkspaceSchema),
  })

  const onSubmit = async (data: CreateWorkspaceForm) => {
    try {
      setIsLoading(true)
      setError('')

      const formData = new FormData()
      formData.append('name', data.name)

      const result = await createWorkspace(formData)

      if (!result.success) {
        setError(result.error || 'Något gick fel')
        return
      }

      // Close modal, refresh context and page
      onOpenChange(false)
      reset()
      await refresh()
      router.refresh()
    } catch (err) {
      setError('Ett oväntat fel inträffade. Försök igen.')
      console.error('Create workspace error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false)
      reset()
      setError('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center">
            Skapa ny arbetsplats
          </DialogTitle>
          <DialogDescription className="text-center">
            Skapa en ny arbetsplats för att hantera ett annat företag eller
            projekt. Du får 14 dagars kostnadsfri provperiod.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="workspace-name">Arbetsplatsnamn</Label>
              <Input
                id="workspace-name"
                type="text"
                placeholder="t.ex. Mitt Företag AB"
                autoComplete="organization"
                disabled={isLoading}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isLoading}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Skapar...
                </>
              ) : (
                'Skapa arbetsplats'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
