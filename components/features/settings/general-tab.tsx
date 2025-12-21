'use client'

/**
 * Story 5.7: General Settings Tab
 * Workspace name, logo upload, and SNI code display.
 */

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Settings, Upload, Building2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  updateWorkspaceName,
  uploadWorkspaceLogo,
} from '@/app/actions/workspace-settings'
import type { WorkspaceData } from './settings-tabs'

// ============================================================================
// Validation Schema
// ============================================================================

const workspaceNameSchema = z.object({
  name: z.string().min(1, 'Arbetsplatsnamn krävs').max(100, 'Max 100 tecken'),
})

type WorkspaceNameFormData = z.infer<typeof workspaceNameSchema>

// ============================================================================
// Component
// ============================================================================

interface GeneralTabProps {
  workspace: WorkspaceData
}

export function GeneralTab({ workspace }: GeneralTabProps) {
  const [isPending, startTransition] = useTransition()
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(
    workspace.company_logo
  )

  const form = useForm<WorkspaceNameFormData>({
    resolver: zodResolver(workspaceNameSchema),
    defaultValues: {
      name: workspace.name,
    },
  })

  const onSubmitName = (data: WorkspaceNameFormData) => {
    startTransition(async () => {
      const result = await updateWorkspaceName(data.name)
      if (result.success) {
        toast.success(result.message || 'Inställningar sparade')
      } else {
        toast.error(result.error || 'Något gick fel')
      }
    })
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Endast PNG och JPG är tillåtna')
      return
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('Filen får max vara 2MB')
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onload = (event) => {
      setLogoPreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload
    setIsUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      const result = await uploadWorkspaceLogo(formData)
      if (result.success) {
        toast.success(result.message || 'Logotyp sparad')
      } else {
        toast.error(result.error || 'Något gick fel vid uppladdning')
        setLogoPreview(workspace.company_logo)
      }
    } finally {
      setIsUploadingLogo(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Settings className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Allmänna inställningar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Hantera arbetsplatsens namn och varumärke.
            </p>
          </div>
        </div>
      </div>

      {/* Workspace Name Form */}
      <div className="rounded-2xl border bg-card p-6">
        <form onSubmit={form.handleSubmit(onSubmitName)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Arbetsplatsnamn</Label>
            <Input
              id="name"
              {...form.register('name')}
              placeholder="Företagsnamn AB"
              disabled={isPending}
              className={form.formState.errors.name ? 'border-destructive' : ''}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Spara ändringar
          </Button>
        </form>
      </div>

      {/* Logo Upload */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="space-y-4">
          <div>
            <Label>Företagslogotyp</Label>
            <p className="text-sm text-muted-foreground">
              PNG eller JPG, max 2MB
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Logo Preview */}
            <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed bg-muted/50">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logotyp"
                  className="h-full w-full rounded-lg object-contain"
                />
              ) : (
                <Building2 className="h-8 w-8 text-muted-foreground" />
              )}
            </div>

            {/* Upload Button */}
            <div>
              <Label
                htmlFor="logo-upload"
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {isUploadingLogo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Ladda upp logotyp
              </Label>
              <input
                id="logo-upload"
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleLogoChange}
                disabled={isUploadingLogo}
                className="sr-only"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SNI Code (Read-only) */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="space-y-4">
          <div>
            <Label>Bransch (SNI-kod)</Label>
            <p className="text-sm text-muted-foreground">
              Sätts under registrering och kan inte ändras här.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {workspace.sni_code ? (
              <Badge variant="secondary" className="text-sm">
                {workspace.sni_code}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">
                Ingen SNI-kod angiven
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
