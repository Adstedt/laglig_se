'use client'

/**
 * Story 17.12: Document Links Section
 * Shows linked tasks, law list items (författningstext), and kravpunkt evidence
 * links in the document settings panel. Provides actions to link/unlink each.
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { CheckSquare, Scale, ListChecks, X, Loader2 } from 'lucide-react'
import {
  getDocumentLinks,
  linkDocumentToTask,
  unlinkDocumentFromTask,
  linkDocumentToListItem,
  unlinkDocumentFromListItem,
} from '@/app/actions/documents'
import {
  linkEvidenceToRequirement,
  unlinkEvidenceFromRequirement,
} from '@/app/actions/law-list-item-requirements'
import { toast } from 'sonner'
import { TaskPickerDialog } from '@/components/features/documents/task-picker-dialog'
import { LawListItemPickerDialog } from '@/components/features/documents/law-list-item-picker-dialog'
import { RequirementPickerDialog } from '@/components/features/documents/requirement-picker-dialog'
import {
  LinkTargetChooser,
  type LinkKind,
} from '@/components/features/documents/link-target-chooser'

interface LinkedTask {
  id: string
  title: string
  linkId: string
}

interface LinkedListItem {
  id: string
  title: string
  documentNumber: string | null
  linkId: string
}

interface LinkedRequirement {
  id: string
  linkId: string
  text: string
  listItemTitle: string
  listItemDocumentNumber: string | null
}

interface DocumentLinksSectionProps {
  documentId: string
  readOnly?: boolean | undefined
}

export function DocumentLinksSection({
  documentId,
  readOnly,
}: DocumentLinksSectionProps) {
  const [tasks, setTasks] = useState<LinkedTask[]>([])
  const [listItems, setListItems] = useState<LinkedListItem[]>([])
  const [requirements, setRequirements] = useState<LinkedRequirement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
  const [taskPickerOpen, setTaskPickerOpen] = useState(false)
  const [listItemPickerOpen, setListItemPickerOpen] = useState(false)
  const [requirementPickerOpen, setRequirementPickerOpen] = useState(false)

  const loadLinks = useCallback(async () => {
    const result = await getDocumentLinks(documentId)
    if (result.success && result.data) {
      setTasks(result.data.tasks)
      setListItems(result.data.listItems)
      setRequirements(result.data.requirements)
    }
    setIsLoading(false)
  }, [documentId])

  useEffect(() => {
    loadLinks()
  }, [loadLinks])

  const handlePick = (kind: LinkKind) => {
    if (kind === 'task') setTaskPickerOpen(true)
    else if (kind === 'listItem') setListItemPickerOpen(true)
    else if (kind === 'requirement') setRequirementPickerOpen(true)
  }

  const handleLinkTask = async (taskId: string) => {
    const result = await linkDocumentToTask(documentId, taskId)
    if (result.success) {
      toast.success('Uppgift länkad')
      setTaskPickerOpen(false)
      await loadLinks()
    } else {
      toast.error(result.error ?? 'Kunde inte länka uppgift')
    }
  }

  const handleLinkListItem = async (listItemId: string) => {
    const result = await linkDocumentToListItem(documentId, listItemId)
    if (result.success) {
      toast.success('Författningstext länkad')
      setListItemPickerOpen(false)
      await loadLinks()
    } else {
      toast.error(result.error ?? 'Kunde inte länka författningstext')
    }
  }

  const handleLinkRequirement = async (requirementId: string) => {
    const result = await linkEvidenceToRequirement(requirementId, {
      workspaceDocumentId: documentId,
    })
    if (result.success) {
      toast.success('Krav länkat')
      setRequirementPickerOpen(false)
      await loadLinks()
    } else {
      toast.error(result.error ?? 'Kunde inte länka krav')
    }
  }

  const handleUnlinkTask = async (taskId: string) => {
    setUnlinkingId(taskId)
    const result = await unlinkDocumentFromTask(documentId, taskId)
    if (result.success) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      toast.success('Länk borttagen')
    } else {
      toast.error(result.error ?? 'Kunde inte ta bort länk')
    }
    setUnlinkingId(null)
  }

  const handleUnlinkListItem = async (listItemId: string) => {
    setUnlinkingId(listItemId)
    const result = await unlinkDocumentFromListItem(documentId, listItemId)
    if (result.success) {
      setListItems((prev) => prev.filter((li) => li.id !== listItemId))
      toast.success('Länk borttagen')
    } else {
      toast.error(result.error ?? 'Kunde inte ta bort länk')
    }
    setUnlinkingId(null)
  }

  const handleUnlinkRequirement = async (requirementId: string) => {
    setUnlinkingId(requirementId)
    const result = await unlinkEvidenceFromRequirement(requirementId, {
      workspaceDocumentId: documentId,
    })
    if (result.success) {
      setRequirements((prev) => prev.filter((r) => r.id !== requirementId))
      toast.success('Länk borttagen')
    } else {
      toast.error(result.error ?? 'Kunde inte ta bort länk')
    }
    setUnlinkingId(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const linkedTaskIds = tasks.map((t) => t.id)
  const linkedListItemIds = listItems.map((li) => li.id)
  const linkedRequirementIds = requirements.map((r) => r.id)

  const isEmpty =
    tasks.length === 0 && listItems.length === 0 && requirements.length === 0

  return (
    <>
      <div>
        <span className="text-sm font-medium mb-2 block">Länkade till</span>

        {isEmpty && (
          <p className="text-sm text-muted-foreground mb-2">
            Inga länkade uppgifter, författningstexter eller krav
          </p>
        )}

        {tasks.length > 0 && (
          <div className="space-y-1 mb-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 group text-sm"
              >
                <CheckSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 min-w-0 truncate">{task.title}</span>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={() => handleUnlinkTask(task.id)}
                    disabled={unlinkingId === task.id}
                  >
                    {unlinkingId === task.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {listItems.length > 0 && (
          <div className="space-y-1 mb-2">
            {listItems.map((item) => (
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
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={() => handleUnlinkListItem(item.id)}
                    disabled={unlinkingId === item.id}
                  >
                    {unlinkingId === item.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {requirements.length > 0 && (
          <div className="space-y-1 mb-2">
            {requirements.map((req) => {
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
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={() => handleUnlinkRequirement(req.id)}
                      disabled={unlinkingId === req.id}
                    >
                      {unlinkingId === req.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!readOnly && (
          <div className="mt-2">
            <LinkTargetChooser onPick={handlePick} />
          </div>
        )}
      </div>

      <TaskPickerDialog
        open={taskPickerOpen}
        onOpenChange={setTaskPickerOpen}
        excludeIds={linkedTaskIds}
        onSelect={(task) => handleLinkTask(task.id)}
      />

      <LawListItemPickerDialog
        open={listItemPickerOpen}
        onOpenChange={setListItemPickerOpen}
        excludeIds={linkedListItemIds}
        onSelect={(item) => handleLinkListItem(item.id)}
      />

      <RequirementPickerDialog
        open={requirementPickerOpen}
        onOpenChange={setRequirementPickerOpen}
        excludeIds={linkedRequirementIds}
        onSelect={(req) => handleLinkRequirement(req.id)}
      />
    </>
  )
}
