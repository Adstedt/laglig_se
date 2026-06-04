'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import {
  History,
  RotateCcw,
  GitCompare,
  Download,
  FileText,
  FileDown,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  getDocumentVersions,
  restoreDocumentVersion,
  type DocumentVersionEntry,
} from '@/app/actions/documents'
import { cn } from '@/lib/utils'

const SOURCE_LABELS: Record<string, string> = {
  TIPTAP: 'Tiptap',
  IMPORT: 'Import',
  AGENT: 'Agent',
}

function formatAbsoluteTime(date: Date): string {
  return new Date(date).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHrs = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return 'Just nu'
  if (diffMin < 60) return `${diffMin} min sedan`
  if (diffHrs < 24)
    return `${diffHrs} ${diffHrs === 1 ? 'timme' : 'timmar'} sedan`
  if (diffDays < 7)
    return `${diffDays} ${diffDays === 1 ? 'dag' : 'dagar'} sedan`

  return formatAbsoluteTime(date)
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface VersionHistoryPanelProps {
  documentId: string
  currentVersionNumber: number
  onRestore: (_versionNumber: number) => void
  onCompare: (_fromVersionId: string, _toVersionId: string) => void
  // Story 17.17 AC 17 — Model B-aware Återställ button gating. Without these,
  // the panel defaults to permissive (today's behaviour), so existing call
  // sites that don't yet pass them continue to function without regression.
  // Both panel mount points (document-editor + document-table via Story
  // 17.17 AC 16) plumb the real values explicitly.
  documentStatus?: string
  currentDraftVersionId?: string | null
  // Story 17.17 AC 16 — optional custom SheetTrigger child. The table-row
  // mount point passes a compact History-icon-only button (since the row
  // already exposes the version number in its own column). Editor mount
  // keeps today's "History icon + version-number badge" combo.
  trigger?: React.ReactNode
}

/**
 * Story 17.17 AC 17 — Model B-aware Återställ gating. The
 * `restoreDocumentVersion` server action refuses with branch-first guidance
 * for Path C (APPROVED with no draft) and terminal-state guidance for Path D
 * (ARCHIVED / SUPERSEDED) under Story 17.16 v2.1. The panel mirrors those
 * refusals as inline-disabled UI so users never click through to a confusing
 * error toast.
 *
 *  - Path A — dual-state (draft in progress): restore enabled.
 *  - Path B — never-approved draft / in-review: restore enabled.
 *  - Path C — APPROVED with no draft pointer: disabled + Swedish hint.
 *  - Path D — ARCHIVED / SUPERSEDED: disabled + Swedish hint.
 */
function computeRestoreGuard(
  documentStatus: string | undefined,
  currentDraftVersionId: string | null | undefined
): { enabled: boolean; hint: string | null } {
  if (documentStatus === 'ARCHIVED' || documentStatus === 'SUPERSEDED') {
    return { enabled: false, hint: 'Återaktivera dokumentet först' }
  }
  if (documentStatus === 'APPROVED' && currentDraftVersionId == null) {
    return { enabled: false, hint: 'Skapa utkast för att återställa' }
  }
  return { enabled: true, hint: null }
}

export function VersionHistoryPanel({
  documentId,
  currentVersionNumber,
  onRestore,
  onCompare,
  documentStatus,
  currentDraftVersionId,
  trigger,
}: VersionHistoryPanelProps) {
  const restoreGuard = computeRestoreGuard(
    documentStatus,
    currentDraftVersionId
  )
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<DocumentVersionEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [restoreTarget, setRestoreTarget] =
    useState<DocumentVersionEntry | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [selectedForCompare, setSelectedForCompare] = useState<string | null>(
    null
  )

  const fetchVersions = useCallback(async () => {
    setLoading(true)
    const result = await getDocumentVersions(documentId)
    if (result.success && result.data) {
      setVersions(result.data)
    }
    setLoading(false)
  }, [documentId])

  useEffect(() => {
    if (open) {
      fetchVersions()
    }
  }, [open, fetchVersions, currentVersionNumber])

  const handleRestore = async () => {
    if (!restoreTarget) return
    setRestoring(true)
    const result = await restoreDocumentVersion(
      documentId,
      restoreTarget.version_number
    )
    setRestoring(false)
    setRestoreTarget(null)
    if (result.success && result.data) {
      onRestore(result.data.versionNumber)
      fetchVersions()
    }
  }

  const handleCompareClick = (versionId: string) => {
    if (!selectedForCompare) {
      setSelectedForCompare(versionId)
    } else if (selectedForCompare !== versionId) {
      onCompare(selectedForCompare, versionId)
      setSelectedForCompare(null)
    } else {
      setSelectedForCompare(null)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {trigger ?? (
            <Button variant="ghost" size="sm" className="gap-1.5">
              <History className="h-4 w-4" />
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {currentVersionNumber}
              </Badge>
            </Button>
          )}
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:max-w-[400px] p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle>Versionshistorik</SheetTitle>
            <SheetDescription className="sr-only">
              Visa och hantera dokumentversioner
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 pl-4 pr-5">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Laddar versioner...
              </div>
            ) : versions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Inga versioner hittades.
              </div>
            ) : (
              <div className="space-y-1 pb-4">
                {versions.map((version) => {
                  const isCurrent =
                    version.version_number === currentVersionNumber
                  const isSelectedForCompare = selectedForCompare === version.id

                  return (
                    <div
                      key={version.id}
                      className={cn(
                        'rounded-md border p-3 transition-colors',
                        isCurrent && 'border-primary/50 bg-primary/5',
                        isSelectedForCompare &&
                          'ring-2 ring-inset ring-blue-500'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarFallback className="text-[10px]">
                              {getInitials(version.author.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium">
                                v{version.version_number}
                              </span>
                              {isCurrent && (
                                <Badge
                                  variant="default"
                                  className="px-1.5 py-0 text-[10px]"
                                >
                                  Aktuell
                                </Badge>
                              )}
                              <Badge
                                variant="outline"
                                className="px-1.5 py-0 text-[10px]"
                              >
                                {SOURCE_LABELS[version.source] ??
                                  version.source}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {version.author.name}
                            </p>
                          </div>
                        </div>
                        <span
                          className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0"
                          title={formatAbsoluteTime(version.created_at)}
                        >
                          {formatRelativeTime(version.created_at)}
                        </span>
                      </div>

                      {version.change_summary && (
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                          {version.change_summary}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleCompareClick(version.id)}
                        >
                          <GitCompare className="mr-1 h-3 w-3" />
                          {isSelectedForCompare ? 'Avmarkera' : 'Jämför'}
                        </Button>
                        {!isCurrent && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setRestoreTarget(version)}
                              disabled={!restoreGuard.enabled}
                              title={restoreGuard.hint ?? undefined}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              Återställ
                            </Button>
                            {restoreGuard.hint && (
                              <span className="text-[10px] text-muted-foreground italic">
                                {restoreGuard.hint}
                              </span>
                            )}
                          </>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                            >
                              <Download className="mr-1 h-3 w-3" />
                              Exportera
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem
                              onClick={() => {
                                window.open(
                                  `/api/workspace/documents/${documentId}/export?format=docx&versionNumber=${version.version_number}`,
                                  '_blank'
                                )
                              }}
                            >
                              <FileText className="mr-2 h-3 w-3" />
                              Word (.docx)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                window.open(
                                  `/api/workspace/documents/${documentId}/export?format=pdf&versionNumber=${version.version_number}`,
                                  '_blank'
                                )
                              }}
                            >
                              <FileDown className="mr-2 h-3 w-3" />
                              PDF (.pdf)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Restore confirmation dialog */}
      <AlertDialog
        open={!!restoreTarget}
        onOpenChange={(o) => !o && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Återställ version</AlertDialogTitle>
            <AlertDialogDescription>
              Vill du återställa till version {restoreTarget?.version_number}?
              En ny version skapas med det gamla innehållet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={restoring}>
              {restoring ? 'Återställer...' : 'Återställ'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
