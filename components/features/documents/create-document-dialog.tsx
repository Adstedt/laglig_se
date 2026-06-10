'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  FileText,
  Loader2,
  LayoutTemplate,
  File,
  CheckSquare,
  Scale,
  ListChecks,
  X,
} from 'lucide-react'
import { WorkspaceDocumentType } from '@prisma/client'
import { trackEvent } from '@/lib/track-event'
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
import {
  createDocument,
  getDocumentTemplates,
  linkDocumentToTask,
  linkDocumentToListItem,
} from '@/app/actions/documents'
import { linkEvidenceToRequirement } from '@/app/actions/law-list-item-requirements'
import { TaskPickerDialog } from '@/components/features/documents/task-picker-dialog'
import { LawListItemPickerDialog } from '@/components/features/documents/law-list-item-picker-dialog'
import {
  RequirementPickerDialog,
  type PickedRequirement,
} from '@/components/features/documents/requirement-picker-dialog'
import {
  LinkTargetChooser,
  type LinkKind,
} from '@/components/features/documents/link-target-chooser'

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
  documentNumber: z.string().max(50, 'Max 50 tecken').optional(),
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
  const [taskPickerOpen, setTaskPickerOpen] = useState(false)
  const [listItemPickerOpen, setListItemPickerOpen] = useState(false)
  const [requirementPickerOpen, setRequirementPickerOpen] = useState(false)
  const [stagedTasks, setStagedTasks] = useState<
    { id: string; title: string }[]
  >([])
  const [stagedListItems, setStagedListItems] = useState<
    { id: string; title: string; documentNumber: string }[]
  >([])
  const [stagedRequirements, setStagedRequirements] = useState<
    PickedRequirement[]
  >([])

  const handlePickLinkTarget = (kind: LinkKind) => {
    if (kind === 'task') setTaskPickerOpen(true)
    else if (kind === 'listItem') setListItemPickerOpen(true)
    else if (kind === 'requirement') setRequirementPickerOpen(true)
  }

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
        documentNumber: data.documentNumber?.trim() || null,
      })

      if (!result.success) {
        setError(result.error ?? 'Kunde inte skapa dokument')
        toast.error(result.error ?? 'Kunde inte skapa dokument')
        return
      }

      const docId = result.data!.id
      trackEvent('document_created', { documentType: data.documentType })

      if (
        stagedTasks.length > 0 ||
        stagedListItems.length > 0 ||
        stagedRequirements.length > 0
      ) {
        const linkResults = await Promise.allSettled([
          ...stagedTasks.map((t) => linkDocumentToTask(docId, t.id)),
          ...stagedListItems.map((li) => linkDocumentToListItem(docId, li.id)),
          ...stagedRequirements.map((r) =>
            linkEvidenceToRequirement(r.id, { workspaceDocumentId: docId })
          ),
        ])
        const failed = linkResults.filter(
          (r) =>
            r.status === 'rejected' ||
            (r.status === 'fulfilled' && !r.value.success)
        ).length
        if (failed > 0) {
          toast.error(
            `Dokument skapat, men ${failed} länk(ar) kunde inte skapas`
          )
        }
      }

      reset()
      setSelectedTemplateId(null)
      setStagedTasks([])
      setStagedListItems([])
      setStagedRequirements([])
      onOpenChange(false)
      router.push(`/workspace/styrdokument/${docId}/edit`)
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
    setStagedTasks([])
    setStagedListItems([])
    setStagedRequirements([])
    setError('')
    onOpenChange(false)
  }, [onOpenChange, reset])

  return (
    <>
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
            {/* Template */}
            <div className="space-y-2">
              <Label htmlFor="template">Mall</Label>
              <Select
                value={selectedTemplateId ?? '__blank__'}
                onValueChange={(value) => {
                  if (value === '__blank__') {
                    handleTemplateSelect(null)
                  } else {
                    const template = templates.find((t) => t.id === value)
                    if (template) handleTemplateSelect(template)
                  }
                }}
                disabled={isLoading || loadingTemplates}
              >
                <SelectTrigger id="template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__blank__">
                    <span className="flex items-center gap-2">
                      <File className="h-4 w-4 text-muted-foreground" />
                      Tomt dokument
                    </span>
                  </SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <span className="flex items-center gap-2">
                        <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
                        {template.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplate && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2.5">
                  {selectedTemplate.description && (
                    <p className="text-sm text-foreground leading-relaxed">
                      {selectedTemplate.description}
                    </p>
                  )}
                  {extractHeadings(selectedTemplate.content_json).length >
                    0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Innehåller
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {extractHeadings(selectedTemplate.content_json).map(
                          (heading, i) => (
                            <span
                              key={i}
                              className="rounded border bg-background px-1.5 py-0.5 text-xs text-muted-foreground"
                            >
                              {heading}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Titel <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="T.ex. Arbetsmiljöpolicy 2026"
                {...register('title')}
                disabled={isLoading}
                aria-required="true"
              />
              {errors.title && (
                <p className="text-sm text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>

            {/* Document number (optional) */}
            <div className="space-y-2">
              <Label
                htmlFor="documentNumber"
                className="flex items-center gap-2"
              >
                Dokumentnummer
                <span className="text-xs font-normal text-muted-foreground">
                  (valfritt)
                </span>
              </Label>
              <Input
                id="documentNumber"
                placeholder="T.ex. POL-2026-001"
                maxLength={50}
                {...register('documentNumber')}
                disabled={isLoading}
              />
              {errors.documentNumber && (
                <p className="text-sm text-destructive">
                  {errors.documentNumber.message}
                </p>
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
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Subtle pre-creation linking */}
            <div className="border-t pt-3 space-y-2">
              {(stagedTasks.length > 0 ||
                stagedListItems.length > 0 ||
                stagedRequirements.length > 0) && (
                <div className="space-y-1">
                  {stagedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 group text-sm"
                    >
                      <CheckSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 min-w-0 truncate">
                        {task.title}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={() =>
                          setStagedTasks((prev) =>
                            prev.filter((t) => t.id !== task.id)
                          )
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {stagedListItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 group text-sm"
                    >
                      <Scale className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 min-w-0 truncate">
                        {item.documentNumber
                          ? `${item.documentNumber} — ${item.title}`
                          : item.title}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={() =>
                          setStagedListItems((prev) =>
                            prev.filter((li) => li.id !== item.id)
                          )
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {stagedRequirements.map((req) => {
                    const parent = req.listItemDocumentNumber
                      ? `${req.listItemDocumentNumber} — ${req.listItemTitle}`
                      : req.listItemTitle
                    return (
                      <div
                        key={req.id}
                        className="flex items-start gap-2 group text-sm"
                      >
                        <ListChecks className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="line-clamp-2" title={req.text}>
                            {req.text}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {parent}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                          onClick={() =>
                            setStagedRequirements((prev) =>
                              prev.filter((r) => r.id !== req.id)
                            )
                          }
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
              <LinkTargetChooser
                onPick={handlePickLinkTarget}
                disabled={isLoading}
              />
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

      <TaskPickerDialog
        open={taskPickerOpen}
        onOpenChange={setTaskPickerOpen}
        excludeIds={stagedTasks.map((t) => t.id)}
        onSelect={(task) => {
          setStagedTasks((prev) => [...prev, task])
          setTaskPickerOpen(false)
        }}
      />

      <LawListItemPickerDialog
        open={listItemPickerOpen}
        onOpenChange={setListItemPickerOpen}
        excludeIds={stagedListItems.map((li) => li.id)}
        onSelect={(item) => {
          setStagedListItems((prev) => [
            ...prev,
            {
              id: item.id,
              title: item.documentTitle,
              documentNumber: item.documentNumber,
            },
          ])
          setListItemPickerOpen(false)
        }}
      />

      <RequirementPickerDialog
        open={requirementPickerOpen}
        onOpenChange={setRequirementPickerOpen}
        excludeIds={stagedRequirements.map((r) => r.id)}
        onSelect={(req) => {
          setStagedRequirements((prev) => [...prev, req])
          setRequirementPickerOpen(false)
        }}
      />
    </>
  )
}
