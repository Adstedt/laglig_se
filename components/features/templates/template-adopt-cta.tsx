'use client'

/**
 * Story 12.10: Template Adopt CTA
 * Enabled button that triggers template adoption into workspace.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { adoptTemplate } from '@/app/actions/template-adoption'
import {
  WorkspaceSelectorDialog,
  type UserWorkspace,
} from './workspace-selector-dialog'

interface TemplateAdoptCtaProps {
  templateSlug: string
  workspaces: UserWorkspace[]
  currentWorkspaceId: string
}

export function TemplateAdoptCta({
  templateSlug,
  workspaces,
  currentWorkspaceId,
}: TemplateAdoptCtaProps) {
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const router = useRouter()

  function handleAdopt(workspaceId?: string | undefined) {
    startTransition(async () => {
      const result = await adoptTemplate({ templateSlug, workspaceId })
      if (result.success && result.data) {
        toast.success(
          `Mallen '${result.data.listName}' har lagts till med ${result.data.itemCount} dokument`
        )
        router.push('/laglistor')
      } else {
        toast.error(result.error ?? 'Ett oväntat fel uppstod')
      }
    })
  }

  function handleClick() {
    if (workspaces.length > 1) {
      setDialogOpen(true)
    } else {
      handleAdopt()
    }
  }

  return (
    <>
      <Button
        size="sm"
        className="gap-1.5 shrink-0"
        disabled={isPending}
        onClick={handleClick}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        Använd denna mall
      </Button>
      <WorkspaceSelectorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspaceId}
        onConfirm={(wsId) => {
          setDialogOpen(false)
          handleAdopt(wsId)
        }}
      />
    </>
  )
}
