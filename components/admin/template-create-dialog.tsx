'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { createTemplate } from '@/app/actions/admin-templates'
import { Button } from '@/components/ui/button'
import { DialogDescription } from '@/components/ui/dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { generateSlug } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(1, 'Namn krävs'),
  slug: z.string().min(1, 'Slug krävs'),
  domain: z.string().min(1, 'Domän krävs'),
  description: z.string().optional(),
  target_audience: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface TemplateCreateDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
}

export function TemplateCreateDialog({
  open,
  onOpenChange,
}: TemplateCreateDialogProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      slug: '',
      domain: '',
      description: '',
      target_audience: '',
    },
  })

  const onSubmit = async (data: FormData) => {
    setServerError(null)
    const result = await createTemplate(data)
    if (result.success && result.templateId) {
      reset()
      onOpenChange(false)
      router.push(`/admin/templates/${result.templateId}`)
    } else {
      setServerError(result.error ?? 'Ett oväntat fel uppstod')
    }
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      reset()
      setServerError(null)
    }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skapa mall</DialogTitle>
          <DialogDescription>
            Fyll i namn och domän för att skapa en ny mall. Slug genereras
            automatiskt.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-name">Namn *</Label>
            <Input
              id="create-name"
              {...register('name')}
              onBlur={(e) => {
                const slug = generateSlug(e.target.value)
                setValue('slug', slug, { shouldValidate: true })
              }}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-slug">Slug</Label>
            <Input id="create-slug" {...register('slug')} />
            {errors.slug && (
              <p className="text-sm text-destructive">{errors.slug.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-domain">Domän *</Label>
            <Input id="create-domain" {...register('domain')} />
            {errors.domain && (
              <p className="text-sm text-destructive">
                {errors.domain.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-description">Beskrivning</Label>
            <Textarea
              id="create-description"
              {...register('description')}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-target-audience">Målgrupp</Label>
            <Textarea
              id="create-target-audience"
              {...register('target_audience')}
              rows={2}
            />
          </div>

          {serverError && (
            <p className="text-sm text-destructive">{serverError}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Skapar...' : 'Skapa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
