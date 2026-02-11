'use client'

/**
 * Story 4.11: Manage List Modal
 * Story 12.10b: Refactored into multi-step template-aware creation flow.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import {
  createDocumentList,
  updateDocumentList,
  deleteDocumentList,
  type DocumentListSummary,
} from '@/app/actions/document-list'
import { CreateListChooser } from './create-list-chooser'
import { CreateListFromTemplate } from './create-list-from-template'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'

type Step = 'choose' | 'from-template' | 'blank'

interface ManageListModalProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  mode: 'create' | 'edit'
  list?: DocumentListSummary | undefined
  templates?: PublishedTemplate[] | undefined
  onCreated: (_listId: string) => void
  onUpdated: () => void
  onDeleted: () => void
}

export function ManageListModal({
  open,
  onOpenChange,
  mode,
  list,
  templates,
  onCreated,
  onUpdated,
  onDeleted,
}: ManageListModalProps) {
  const hasTemplates = (templates?.length ?? 0) > 0

  // Multi-step state (only for create mode)
  const initialStep: Step =
    mode === 'create' && hasTemplates ? 'choose' : 'blank'
  const [step, setStep] = useState<Step>(initialStep)
  const [selectedTemplate, setSelectedTemplate] =
    useState<PublishedTemplate | null>(null)

  // Blank form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal opens/closes or mode changes
  useEffect(() => {
    if (mode === 'edit' && list) {
      setName(list.name)
      setDescription(list.description ?? '')
      setIsDefault(list.isDefault)
    } else {
      setName('')
      setDescription('')
      setIsDefault(false)
    }
    setError(null)
    setSelectedTemplate(null)
    setStep(mode === 'create' && hasTemplates ? 'choose' : 'blank')
  }, [mode, list, open, hasTemplates])

  const goForward = useCallback((nextStep: Step) => {
    setStep(nextStep)
  }, [])

  const goBack = useCallback(() => {
    setStep('choose')
  }, [])

  const handleSelectTemplate = useCallback(
    (template: PublishedTemplate) => {
      setSelectedTemplate(template)
      goForward('from-template')
    },
    [goForward]
  )

  const handleSelectBlank = useCallback(() => {
    goForward('blank')
  }, [goForward])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (mode === 'create') {
        const result = await createDocumentList({
          workspaceId: '',
          name: name.trim(),
          description: description.trim() || undefined,
          isDefault,
        })

        if (result.success && result.data) {
          onCreated(result.data.id)
        } else {
          setError(result.error ?? 'Kunde inte skapa listan')
        }
      } else if (list) {
        const result = await updateDocumentList({
          listId: list.id,
          name: name.trim(),
          description: description.trim() || null,
          isDefault,
        })

        if (result.success) {
          onUpdated()
        } else {
          setError(result.error ?? 'Kunde inte uppdatera listan')
        }
      }
    } catch (err) {
      console.error('Submit error:', err)
      setError('Något gick fel')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!list) return

    setIsDeleting(true)

    try {
      const result = await deleteDocumentList(list.id)

      if (result.success) {
        setShowDeleteConfirm(false)
        onDeleted()
      } else {
        setError(result.error ?? 'Kunde inte ta bort listan')
        setShowDeleteConfirm(false)
      }
    } catch (err) {
      console.error('Delete error:', err)
      setError('Något gick fel')
      setShowDeleteConfirm(false)
    } finally {
      setIsDeleting(false)
    }
  }

  const isValid = name.trim().length > 0

  // Title and description per step
  const getTitle = () => {
    if (mode === 'edit') return 'Redigera lista'
    if (step === 'choose') return 'Skapa ny laglista'
    if (step === 'from-template') return 'Skapa från mall'
    return 'Skapa ny lista'
  }

  const getDescription = () => {
    if (mode === 'edit') return 'Uppdatera listans namn och inställningar.'
    if (step === 'choose') return 'Välj hur du vill börja.'
    if (step === 'from-template') return undefined
    return 'Skapa en ny dokumentlista för att organisera relevanta lagar och rättsfall.'
  }

  // Render the blank form (shared between create-blank and edit)
  const renderBlankForm = () => (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Back button (only when templates exist and creating) */}
      {mode === 'create' && hasTemplates && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="w-fit -ml-2 gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </Button>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Namn</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="T.ex. Huvudlista, GDPR-relaterat..."
          maxLength={100}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Beskrivning (valfritt)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Kort beskrivning av listans syfte..."
          maxLength={500}
          rows={3}
        />
      </div>

      <div className="flex items-center justify-between py-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="default">Standardlista</Label>
          <p className="text-sm text-muted-foreground">
            Standardlistan visas först när du öppnar sidan.
          </p>
        </div>
        <Switch
          id="default"
          checked={isDefault}
          onCheckedChange={setIsDefault}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
        {mode === 'edit' && list && !list.isDefault && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-destructive hover:text-destructive mr-auto"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Ta bort lista
          </Button>
        )}
        <div className="flex gap-2 ml-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Avbryt
          </Button>
          <Button type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Skapa' : 'Spara'}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )

  // Render step content (for create mode with templates)
  const renderStepContent = () => {
    // Edit mode — always show the form directly (no step machine)
    if (mode === 'edit') return renderBlankForm()

    if (step === 'choose' && templates) {
      return (
        <CreateListChooser
          templates={templates}
          onSelectTemplate={handleSelectTemplate}
          onSelectBlank={handleSelectBlank}
        />
      )
    }

    if (step === 'from-template' && selectedTemplate) {
      return (
        <CreateListFromTemplate
          template={selectedTemplate}
          onBack={goBack}
          onCreated={onCreated}
        />
      )
    }

    return renderBlankForm()
  }

  const descriptionText = getDescription()

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{getTitle()}</DialogTitle>
            {descriptionText && (
              <DialogDescription>{descriptionText}</DialogDescription>
            )}
          </DialogHeader>

          {renderStepContent()}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort listan?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort listan{' '}
              <strong className="text-foreground">{list?.name}</strong>?
              <br />
              <br />
              Detta kommer att ta bort alla dokument från listan. Dokumenten
              kommer fortfarande vara tillgängliga i databasen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
