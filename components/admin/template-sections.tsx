'use client'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  createTemplateSection,
  deleteTemplateSection,
  reorderTemplateSections,
  updateTemplateSection,
} from '@/app/actions/admin-templates'
import { TemplateSectionItems } from '@/components/admin/template-section-items'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface SectionData {
  id: string
  section_number: string
  name: string
  description: string | null
  position: number
  item_count: number
}

interface TemplateSectionsProps {
  templateId: string
  sections: SectionData[]
  totalDocs: number
}

const MIN_DOCS_PER_SECTION = 3
const MAX_SECTION_PERCENTAGE = 0.3

function getSectionWarnings(
  section: { item_count: number },
  totalDocs: number
): string[] {
  const warnings: string[] = []
  if (section.item_count < MIN_DOCS_PER_SECTION) {
    warnings.push(`Färre än ${MIN_DOCS_PER_SECTION} dokument`)
  }
  if (
    totalDocs > 0 &&
    section.item_count / totalDocs > MAX_SECTION_PERCENTAGE
  ) {
    warnings.push(
      `Mer än ${Math.round(MAX_SECTION_PERCENTAGE * 100)}% av totala dokument`
    )
  }
  return warnings
}

export function TemplateSections({
  templateId,
  sections: initialSections,
  totalDocs,
}: TemplateSectionsProps) {
  const router = useRouter()
  const dndId = useId()
  const [sections, setSections] = useState(initialSections)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setSections(initialSections)
  }, [initialSections])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SectionData | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  )

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sections.findIndex((s) => s.id === active.id)
    const newIndex = sections.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(sections, oldIndex, newIndex)
    setSections(reordered)

    startTransition(async () => {
      const result = await reorderTemplateSections(
        templateId,
        reordered.map((s) => s.id)
      )
      if (!result.success) {
        toast.error(result.error ?? 'Kunde inte ändra ordning')
        setSections(initialSections)
      }
    })
  }

  const handleAddSection = async (data: {
    name: string
    section_number: string
    description?: string
  }) => {
    const result = await createTemplateSection(templateId, data)
    if (result.success) {
      toast.success('Sektion tillagd')
      setShowAddDialog(false)
      router.refresh()
    } else {
      toast.error(result.error ?? 'Kunde inte lägga till sektion')
    }
  }

  const handleDeleteSection = async () => {
    if (!deleteTarget) return
    const result = await deleteTemplateSection(deleteTarget.id)
    if (result.success) {
      toast.success('Sektion borttagen')
      setDeleteTarget(null)
      router.refresh()
    } else {
      toast.error(result.error ?? 'Kunde inte ta bort sektion')
    }
  }

  const toggleExpand = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Sektioner ({sections.length})</CardTitle>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Lägg till sektion
        </Button>
      </CardHeader>
      <CardContent>
        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Inga sektioner ännu. Lägg till en sektion för att komma igång.
          </p>
        ) : (
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            accessibility={{
              screenReaderInstructions: {
                draggable:
                  'Tryck mellanslag för att lyfta sektionen. Använd piltangenter för att flytta. Tryck mellanslag igen för att placera.',
              },
            }}
          >
            <SortableContext
              items={sections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {sections.map((section) => (
                  <SortableSectionItem
                    key={section.id}
                    section={section}
                    totalDocs={totalDocs}
                    isExpanded={expandedSections.has(section.id)}
                    onToggleExpand={() => toggleExpand(section.id)}
                    onDelete={() => setDeleteTarget(section)}
                    isPending={isPending}
                    templateId={templateId}
                    allSections={sections.map((s) => ({
                      id: s.id,
                      name: s.name,
                    }))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>

      <AddSectionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSubmit={handleAddSection}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort sektion</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort sektionen &ldquo;
              {deleteTarget?.name}&rdquo;?
              {deleteTarget && deleteTarget.item_count > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  Sektionen innehåller {deleteTarget.item_count} dokument.
                  Flytta dem först.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSection}
              disabled={deleteTarget ? deleteTarget.item_count > 0 : false}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

// ============================================================================
// Sortable Section Item
// ============================================================================

function SortableSectionItem({
  section,
  totalDocs,
  isExpanded,
  onToggleExpand,
  onDelete,
  isPending,
  templateId,
  allSections,
}: {
  section: SectionData
  totalDocs: number
  isExpanded: boolean
  onToggleExpand: () => void
  onDelete: () => void
  isPending: boolean
  templateId: string
  allSections: { id: string; name: string }[]
}) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(section.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditingName])

  const warnings = getSectionWarnings(section, totalDocs)

  const handleSaveName = async () => {
    const trimmed = editedName.trim()
    if (trimmed && trimmed !== section.name) {
      const result = await updateTemplateSection(section.id, { name: trimmed })
      if (!result.success) {
        toast.error(result.error ?? 'Kunde inte uppdatera namn')
        setEditedName(section.name)
      }
    } else {
      setEditedName(section.name)
    }
    setIsEditingName(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveName()
    else if (e.key === 'Escape') {
      setEditedName(section.name)
      setIsEditingName(false)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border bg-card transition-colors',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <div className="flex items-center gap-3 p-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Dra för att ändra ordning"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <button
          onClick={onToggleExpand}
          className="text-muted-foreground hover:text-foreground"
          aria-label={isExpanded ? 'Dölj objekt' : 'Visa objekt'}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <Badge variant="outline" className="shrink-0 text-xs">
          {section.section_number}
        </Badge>

        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <Input
              ref={inputRef}
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={handleKeyDown}
              className="h-8"
              maxLength={200}
            />
          ) : (
            <span className="font-medium">{section.name}</span>
          )}
        </div>

        <Badge variant="secondary" className="shrink-0">
          {section.item_count} dok
        </Badge>

        {warnings.map((warning) => (
          <Badge
            key={warning}
            variant="outline"
            className={cn(
              'shrink-0 text-xs',
              warning.includes('Färre')
                ? 'border-yellow-400 text-yellow-700'
                : 'border-red-400 text-red-700'
            )}
          >
            <AlertTriangle className="mr-1 h-3 w-3" />
            {warning}
          </Badge>
        ))}

        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => setIsEditingName(true)}
          disabled={isPending}
          aria-label="Byt namn"
        >
          <Pencil className="h-4 w-4" />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          disabled={isPending}
          aria-label={`Ta bort sektion ${section.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {isExpanded && (
        <div className="border-t px-3 py-2">
          <TemplateSectionItems
            sectionId={section.id}
            templateId={templateId}
            availableSections={allSections}
          />
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Add Section Dialog
// ============================================================================

const addSectionSchema = z.object({
  name: z.string().min(1, 'Namn krävs'),
  section_number: z.string().min(1, 'Sektionsnummer krävs'),
  description: z.string().optional(),
})

function AddSectionDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (_open: boolean) => void
  onSubmit: (_data: {
    name: string
    section_number: string
    description?: string
  }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [sectionNumber, setSectionNumber] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsed = addSectionSchema.safeParse({
      name,
      section_number: sectionNumber,
      description: description || undefined,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Ogiltig indata')
      return
    }

    setIsSubmitting(true)
    await onSubmit({
      name: parsed.data.name,
      section_number: parsed.data.section_number,
      ...(parsed.data.description
        ? { description: parsed.data.description }
        : {}),
    })
    setIsSubmitting(false)
    setName('')
    setSectionNumber('')
    setDescription('')
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setName('')
      setSectionNumber('')
      setDescription('')
      setError(null)
    }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lägg till sektion</DialogTitle>
          <DialogDescription>
            Ange namn och sektionsnummer för den nya sektionen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="section-name">Namn *</Label>
            <Input
              id="section-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="section-number">Sektionsnummer *</Label>
            <Input
              id="section-number"
              value={sectionNumber}
              onChange={(e) => setSectionNumber(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="section-description">Beskrivning</Label>
            <Textarea
              id="section-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Lägger till...' : 'Lägg till'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
