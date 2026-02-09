'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { updateTemplate } from '@/app/actions/admin-templates'
import { Button } from '@/components/ui/button'
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
  primary_regulatory_bodies: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface TemplateEditFormProps {
  template: {
    id: string
    name: string
    slug: string
    description: string | null
    domain: string
    target_audience: string | null
    primary_regulatory_bodies: string[]
  }
  onCancel: () => void
  onSaved: () => void
}

export function TemplateEditForm({
  template,
  onCancel,
  onSaved,
}: TemplateEditFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: template.name,
      slug: template.slug,
      domain: template.domain,
      description: template.description ?? '',
      target_audience: template.target_audience ?? '',
      primary_regulatory_bodies: template.primary_regulatory_bodies.join(', '),
    },
  })

  const onSubmit = async (data: FormData) => {
    setServerError(null)
    const bodies = data.primary_regulatory_bodies
      ? data.primary_regulatory_bodies
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []

    const result = await updateTemplate(template.id, {
      name: data.name,
      slug: data.slug,
      domain: data.domain,
      description: data.description || undefined,
      target_audience: data.target_audience || undefined,
      primary_regulatory_bodies: bodies,
    })

    if (result.success) {
      toast.success('Mallen har uppdaterats')
      router.refresh()
      onSaved()
    } else {
      setServerError(result.error ?? 'Ett oväntat fel uppstod')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-name">Namn *</Label>
        <Input
          id="edit-name"
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
        <Label htmlFor="edit-slug">Slug</Label>
        <Input id="edit-slug" {...register('slug')} />
        {errors.slug && (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-domain">Domän *</Label>
        <Input id="edit-domain" {...register('domain')} />
        {errors.domain && (
          <p className="text-sm text-destructive">{errors.domain.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-description">Beskrivning</Label>
        <Textarea id="edit-description" {...register('description')} rows={3} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-target-audience">Målgrupp</Label>
        <Textarea
          id="edit-target-audience"
          {...register('target_audience')}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-regulatory-bodies">
          Regulatoriska organ (kommaseparerade)
        </Label>
        <Input
          id="edit-regulatory-bodies"
          {...register('primary_regulatory_bodies')}
        />
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Avbryt
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sparar...' : 'Spara'}
        </Button>
      </div>
    </form>
  )
}
