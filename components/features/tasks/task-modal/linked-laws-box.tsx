'use client'

/**
 * Story 6.6: Linked Documents Box
 * Display and manage linked legal documents with cascading selection.
 *
 * Picker: uses the shared `LawListItemPickerDialog` (Story 17.12) for
 * selection. The picker stays open after each successful link to support
 * a multi-link flow.
 *
 * Performance: Optimistic UI for both link and unlink operations.
 */

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Scale,
  Plus,
  X,
  ExternalLink,
  FolderOpen,
  FileText,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  unlinkListItemFromTask,
  linkListItemToTask,
} from '@/app/actions/task-modal'
import {
  LawListItemPickerDialog,
  type PickedLawListItem,
} from '@/components/features/documents/law-list-item-picker-dialog'
import { toast } from 'sonner'
import type { TaskDetails } from '@/app/actions/task-modal'

// Use the same type as TaskDetails to ensure compatibility
type LinkedLaw = TaskDetails['list_item_links'][number]

interface LinkedLawsBoxProps {
  taskId: string
  links: LinkedLaw[]
  onUpdate: () => Promise<void>
  /** Optimistic update callback for immediate UI feedback */
  onOptimisticUpdate?: ((_links: LinkedLaw[]) => void) | undefined
  /** Callback to open a list item in the Legal Document Modal */
  onOpenListItem?: ((_listItemId: string) => void) | undefined
}

export function LinkedLawsBox({
  taskId,
  links,
  onUpdate,
  onOptimisticUpdate,
  onOpenListItem,
}: LinkedLawsBoxProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
  // In-flight optimistic link IDs — union'd with existing link IDs to form
  // excludeIds for the picker so the same item can't be clicked twice.
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set())

  // Optimistic unlink
  const handleUnlink = useCallback(
    async (listItemId: string) => {
      const linkToRemove = links.find((l) => l.law_list_item.id === listItemId)
      if (!linkToRemove) return

      setUnlinkingId(listItemId)
      const optimisticLinks = links.filter(
        (l) => l.law_list_item.id !== listItemId
      )
      onOptimisticUpdate?.(optimisticLinks)

      const result = await unlinkListItemFromTask(taskId, listItemId)

      if (result.success) {
        await onUpdate()
      } else {
        onOptimisticUpdate?.(links)
        toast.error('Kunde inte ta bort länk', { description: result.error })
      }

      setUnlinkingId(null)
    },
    [taskId, links, onUpdate, onOptimisticUpdate]
  )

  // Optimistic link via shared picker.
  // `PickedLawListItem` omits the law-list name, so the grouped display
  // briefly shows "Okänd lista" for the new row until onUpdate() returns
  // the real payload (sub-100ms in practice).
  const handleLinkItem = useCallback(
    async (picked: PickedLawListItem) => {
      setOptimisticIds((prev) => {
        const next = new Set(prev)
        next.add(picked.id)
        return next
      })

      const optimisticLink: LinkedLaw = {
        id: `temp-${picked.id}`,
        law_list_item: {
          id: picked.id,
          document: {
            id: picked.documentId,
            title: picked.documentTitle,
            document_number: picked.documentNumber,
            slug: '',
          },
          law_list: { id: '', name: 'Okänd lista' },
        },
      }
      onOptimisticUpdate?.([...links, optimisticLink])

      try {
        const result = await linkListItemToTask(taskId, picked.id)
        if (result.success) {
          toast.success('Dokument länkat')
          await onUpdate()
          // Drop the optimistic marker once real state is reconciled.
          setOptimisticIds((prev) => {
            const next = new Set(prev)
            next.delete(picked.id)
            return next
          })
        } else {
          setOptimisticIds((prev) => {
            const next = new Set(prev)
            next.delete(picked.id)
            return next
          })
          onOptimisticUpdate?.(links)
          toast.error('Kunde inte länka dokument', {
            description: result.error,
          })
        }
      } catch (error) {
        console.error('Failed to link item:', error)
        setOptimisticIds((prev) => {
          const next = new Set(prev)
          next.delete(picked.id)
          return next
        })
        onOptimisticUpdate?.(links)
        toast.error('Kunde inte länka dokument')
      }
    },
    [taskId, links, onUpdate, onOptimisticUpdate]
  )

  // Group links by law list (keyed by list ID to preserve ID for linking)
  const groupedLinks = links.reduce(
    (acc, link) => {
      const listId = link.law_list_item.law_list?.id || 'unknown'
      const listName = link.law_list_item.law_list?.name || 'Okänd lista'
      if (!acc[listId]) {
        acc[listId] = { name: listName, links: [] }
      }
      acc[listId].links.push(link)
      return acc
    },
    {} as Record<string, { name: string; links: LinkedLaw[] }>
  )

  const excludeIds = [
    ...links.map((l) => l.law_list_item.id),
    ...Array.from(optimisticIds),
  ]

  return (
    <>
      <Card className="border-border/60 w-full overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-foreground">
              Länkade dokument
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <Scale className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">
                Inga länkade dokument
              </p>
              <Button
                variant="link"
                size="sm"
                className="text-xs mt-1"
                onClick={() => setPickerOpen(true)}
              >
                + Lägg till länk
              </Button>
            </div>
          ) : (
            <div className="space-y-3 overflow-hidden">
              {Object.entries(groupedLinks).map(
                ([listId, { name: listName, links: listLinks }]) => (
                  <div key={listId} className="space-y-1.5 overflow-hidden">
                    {/* List header */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                      <FolderOpen className="h-3 w-3 shrink-0" />
                      <a
                        href={`/laglistor?list=${listId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate hover:underline"
                      >
                        {listName}
                      </a>
                    </div>
                    {/* Documents in list */}
                    <div className="space-y-1 pl-4 overflow-hidden">
                      {listLinks.map((link) => {
                        const isUnlinking =
                          unlinkingId === link.law_list_item.id
                        return (
                          <div
                            key={link.id || link.law_list_item.id}
                            className={cn(
                              'flex items-center gap-2 py-2 px-2.5 rounded-md overflow-hidden',
                              'hover:bg-muted/50 transition-colors group',
                              onOpenListItem &&
                                !isUnlinking &&
                                'cursor-pointer',
                              isUnlinking && 'opacity-50'
                            )}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (!isUnlinking) {
                                onOpenListItem?.(link.law_list_item.id)
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !isUnlinking) {
                                onOpenListItem?.(link.law_list_item.id)
                              }
                            }}
                          >
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="w-0 flex-1">
                              <p className="text-sm truncate">
                                {link.law_list_item.document.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {link.law_list_item.document.document_number}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <a
                                href={`/browse/lagar/${link.law_list_item.document.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded hover:bg-background"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                              </a>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleUnlink(link.law_list_item.id)
                                }}
                                disabled={isUnlinking}
                              >
                                {isUnlinking ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <X className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <LawListItemPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeIds={excludeIds}
        onSelect={handleLinkItem}
      />
    </>
  )
}
