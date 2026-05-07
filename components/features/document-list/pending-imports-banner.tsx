'use client'

/**
 * Banner surfaced on `/laglistor` when the workspace has any in-flight
 * import (status AWAITING_REVIEW or MATCHING). Each row links back to the
 * granska review surface so users can resume work they left.
 *
 * Per-row ⋯ overflow menu exposes "Avbryt import" — destructive, gated by
 * an AlertDialog confirmation. Hard-deletes the LawListImport (cascades to
 * rows + catalog requests) and refreshes the page so the banner re-renders
 * without the discarded row.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowRight,
  ClipboardCheck,
  Loader2,
  MoreHorizontal,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { discardImport } from '@/app/actions/law-list-import'
import { formatTimeAgo } from '@/lib/utils/time-ago'
import type { PendingImportSummary } from '@/app/actions/law-list-import'

interface PendingImportsBannerProps {
  imports: PendingImportSummary[]
}

const MAX_VISIBLE = 5

export function PendingImportsBanner({ imports }: PendingImportsBannerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmTarget, setConfirmTarget] =
    useState<PendingImportSummary | null>(null)

  if (imports.length === 0) return null

  const visible = imports.slice(0, MAX_VISIBLE)
  const overflow = Math.max(0, imports.length - MAX_VISIBLE)
  const headerCopy =
    imports.length === 1
      ? 'Du har 1 pågående import'
      : `Du har ${imports.length} pågående importer`

  function handleDiscard() {
    if (!confirmTarget) return
    const target = confirmTarget
    setConfirmTarget(null)
    startTransition(async () => {
      const result = await discardImport(target.id)
      if (!result.success) {
        toast.error('Kunde inte avbryta importen', {
          description: result.error,
        })
        return
      }
      toast.success(`Importen "${target.filename}" avbröts`)
      router.refresh()
    })
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck
              className="h-4 w-4 text-muted-foreground"
              aria-hidden
            />
            <p className="text-sm font-medium">{headerCopy}</p>
          </div>

          <ul className="flex flex-col gap-2">
            {visible.map((imp) => (
              <li
                key={imp.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {imp.filename}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {imp.row_count} {imp.row_count === 1 ? 'rad' : 'rader'} ·
                    uppladdad {formatTimeAgo(imp.created_at)}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {imp.status === 'MATCHING' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden
                      />
                      Matchar mot katalogen…
                    </span>
                  ) : (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/laglistor/skapa/${imp.id}/granska`}>
                        Återuppta import
                        <ArrowRight
                          className="ml-1.5 h-3.5 w-3.5"
                          aria-hidden
                        />
                      </Link>
                    </Button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        aria-label={`Fler åtgärder för ${imp.filename}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onSelect={() => setConfirmTarget(imp)}
                        className="text-destructive focus:text-destructive"
                      >
                        Avbryt import
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>

          {overflow > 0 && (
            <p className="text-xs text-muted-foreground">
              +{overflow} till — slutför pågående importer för att se nya.
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Avbryt importen?</AlertDialogTitle>
            <AlertDialogDescription>
              Filen <strong>{confirmTarget?.filename}</strong> och alla{' '}
              {confirmTarget?.row_count} matchningar tas bort. Detta går inte
              att ångra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Behåll</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscard}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Avbryt import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
