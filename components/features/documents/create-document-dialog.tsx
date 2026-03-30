'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileText, Loader2 } from 'lucide-react'
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
import { createDocument } from '@/app/actions/documents'

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

const formSchema = z.object({
  title: z.string().min(1, 'Titel krävs').max(255, 'Max 255 tecken'),
  documentType: z.nativeEnum(WorkspaceDocumentType),
})

type FormValues = z.infer<typeof formSchema>

interface CreateDocumentDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
}

export function CreateDocumentDialog({
  open,
  onOpenChange,
}: CreateDocumentDialogProps) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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

  const onSubmit = async (data: FormValues) => {
    setError('')
    setIsLoading(true)

    try {
      const result = await createDocument({
        title: data.title,
        documentType: data.documentType,
      })

      if (!result.success) {
        setError(result.error ?? 'Kunde inte skapa dokument')
        return
      }

      reset()
      onOpenChange(false)
      router.push(`/workspace/documents/${result.data!.id}/edit`)
    } catch {
      setError('Ett oväntat fel uppstod')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Nytt dokument
          </DialogTitle>
          <DialogDescription>
            Skapa ett nytt dokument i din arbetsplats.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

          <div className="space-y-2">
            <Label htmlFor="documentType">Dokumenttyp</Label>
            <Select
              defaultValue={WorkspaceDocumentType.OTHER}
              onValueChange={(value) =>
                setValue('documentType', value as WorkspaceDocumentType)
              }
              disabled={isLoading}
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

          {/* Template selection — Story 17.7 will populate templates */}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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
