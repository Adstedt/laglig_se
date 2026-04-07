'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileText, Loader2, LayoutTemplate, File } from 'lucide-react'
import { WorkspaceDocumentType } from '@prisma/client'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { createDocument, getDocumentTemplates } from '@/app/actions/documents'
import { cn } from '@/lib/utils'

const DOCUMENT_TYPE_LABELS: Record<WorkspaceDocumentType, string> = {
  POLICY: 'Policy',
  RISK_ASSESSMENT: 'Riskbedömning',
  ACTION_PLAN: 'Handlingsplan',
  PROCEDURE: 'Rutin',
  INSTRUCTION: 'Instruktion',
  CHECKLIST: 'Checklista',
  REPORT: 'Rapport',
  OTHER: 'Övrigt',
}

interface TemplateItem {
  id: string
  name: string
  description: string | null
  document_type: string
  content_json: unknown
  sort_order: number
}

const formSchema = z.object({
  title: z.string().min(1, 'Titel krävs').max(255, 'Max 255 tecken'),
  documentType: z.nativeEnum(WorkspaceDocumentType),
})

type FormValues = z.infer<typeof formSchema>

interface CreateDocumentDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
}

/**
 * Extract heading texts from Tiptap JSON for template preview.
 */
function extractHeadings(contentJson: unknown): string[] {
  const doc = contentJson as {
    content?: Array<{ type: string; content?: Array<{ text?: string }> }>
  }
  if (!doc?.content) return []
  return doc.content
    .filter((n) => n.type === 'heading')
    .map((n) => n.content?.map((c) => c.text ?? '').join('') ?? '')
    .filter(Boolean)
}

export function CreateDocumentDialog({
  open,
  onOpenChange,
}: CreateDocumentDialogProps) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  )

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      documentType: WorkspaceDocumentType.OTHER,
    },
  })

  // Fetch templates when dialog opens
  useEffect(() => {
    if (!open) return
    const fetchTemplates = async () => {
      setLoadingTemplates(true)
      const result = await getDocumentTemplates()
      if (result.success && result.data) {
        setTemplates(result.data as TemplateItem[])
      }
      setLoadingTemplates(false)
    }
    fetchTemplates()
  }, [open])

  const handleTemplateSelect = useCallback(
    (template: TemplateItem | null) => {
      if (template) {
        setSelectedTemplateId(template.id)
        setValue(
          'documentType',
          template.document_type as WorkspaceDocumentType
        )
      } else {
        setSelectedTemplateId(null)
        setValue('documentType', WorkspaceDocumentType.OTHER)
      }
    },
    [setValue]
  )

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  const onSubmit = async (data: FormValues) => {
    setError('')
    setIsLoading(true)

    try {
      const result = await createDocument({
        title: data.title,
        documentType: data.documentType,
        templateId: selectedTemplateId,
      })

      if (!result.success) {
        setError(result.error ?? 'Kunde inte skapa dokument')
        toast.error(result.error ?? 'Kunde inte skapa dokument')
        return
      }

      reset()
      setSelectedTemplateId(null)
      onOpenChange(false)
      router.push(`/workspace/styrdokument/${result.data!.id}/edit`)
    } catch {
      setError('Ett oväntat fel uppstod')
      toast.error('Ett oväntat fel uppstod')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = useCallback(() => {
    reset()
    setSelectedTemplateId(null)
    setError('')
    onOpenChange(false)
  }, [onOpenChange, reset])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Nytt dokument
          </DialogTitle>
          <DialogDescription>
            Välj en mall eller skapa ett tomt dokument.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Empty document option */}
          <button
            type="button"
            onClick={() => handleTemplateSelect(null)}
            className={cn(
              'w-full rounded-md border p-3 text-left transition-colors',
              !selectedTemplateId
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted/50'
            )}
          >
            <div className="flex items-center gap-2">
              <File className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Tomt dokument</span>
            </div>
          </button>

          {/* Templates */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">
                eller välj en mall
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="max-h-[200px] overflow-y-auto rounded-md space-y-1">
              {loadingTemplates ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  Laddar mallar...
                </div>
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleTemplateSelect(template)}
                    className={cn(
                      'w-full rounded-md border p-3 text-left transition-colors',
                      selectedTemplateId === template.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {template.name}
                      </span>
                    </div>
                    {template.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                        {template.description}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Template preview */}
          {selectedTemplate && (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Förhandsgranskning
              </p>
              <div className="space-y-0.5">
                {extractHeadings(selectedTemplate.content_json).map(
                  (heading, i) => (
                    <p key={i} className="text-xs text-foreground">
                      {heading}
                    </p>
                  )
                )}
              </div>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Titel</Label>
            <Input
              id="title"
              placeholder="T.ex. Arbetsmiljöpolicy 2026"
              {...register('title')}
              disabled={isLoading}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Document type */}
          <div className="space-y-2">
            <Label htmlFor="documentType">Dokumenttyp</Label>
            <Select
              {...(selectedTemplate
                ? { value: selectedTemplate.document_type as string }
                : { defaultValue: WorkspaceDocumentType.OTHER })}
              onValueChange={(value) =>
                setValue('documentType', value as WorkspaceDocumentType)
              }
              disabled={isLoading || !!selectedTemplate}
            >
              <SelectTrigger id="documentType">
                <SelectValue placeholder="Välj dokumenttyp" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Skapa dokument
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
