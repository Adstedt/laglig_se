'use client'

/**
 * Story 12.10b Task 5: Template preview + adopt form step.
 */

import { useState, useTransition } from 'react'
import { ArrowLeft, FileText, Layers, Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { adoptTemplate } from '@/app/actions/template-adoption'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'

interface CreateListFromTemplateProps {
  template: PublishedTemplate
  onBack: () => void
  onCreated: (_listId: string) => void
}

export function CreateListFromTemplate({
  template,
  onBack,
  onCreated,
}: CreateListFromTemplateProps) {
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description ?? '')
  const [isDefault, setIsDefault] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    startTransition(async () => {
      const result = await adoptTemplate({
        templateSlug: template.slug,
        name: name.trim(),
        description: description.trim() || undefined,
        isDefault,
      })

      if (result.success && result.data) {
        toast.success(
          `Mallen '${result.data.listName}' har lagts till med ${result.data.itemCount} dokument`
        )
        onCreated(result.data.listId)
      } else {
        toast.error(result.error ?? 'Ett oväntat fel uppstod')
      }
    })
  }

  const isValid = name.trim().length > 0

  return (
    <div className="flex flex-col gap-4">
      {/* Back button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="w-fit -ml-2 gap-1.5"
      >
        <ArrowLeft className="h-4 w-4" />
        Tillbaka
      </Button>

      {/* Template summary */}
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">{template.name}</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {template.document_count} dokument
          </span>
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {template.section_count} kategorier
          </span>
        </div>
        {template.primary_regulatory_bodies.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.primary_regulatory_bodies.map((body) => (
              <Badge key={body} variant="secondary" className="text-[10px]">
                {body}
              </Badge>
            ))}
          </div>
        )}
        {template.description && (
          <p className="text-sm text-muted-foreground">
            {template.description}
          </p>
        )}
      </div>

      {/* Customization form */}
      <div>
        <Separator />
        <p className="mt-3 mb-3 text-sm font-medium text-muted-foreground">
          Anpassa
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="template-name">Namn</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="template-description">Beskrivning (valfritt)</Label>
          <Textarea
            id="template-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="template-default">Standardlista</Label>
            <p className="text-sm text-muted-foreground">
              Standardlistan visas först när du öppnar sidan.
            </p>
          </div>
          <Switch
            id="template-default"
            checked={isDefault}
            onCheckedChange={setIsDefault}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isPending}
          >
            Avbryt
          </Button>
          <Button type="submit" disabled={!isValid || isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Skapa från mall
          </Button>
        </div>
      </form>
    </div>
  )
}
