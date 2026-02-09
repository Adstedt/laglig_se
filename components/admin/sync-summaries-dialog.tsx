'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { syncTemplateSummaries } from '@/app/actions/admin-templates'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TemplateOverlapItem } from '@/lib/admin/template-queries'

interface SyncSummariesDialogProps {
  item: TemplateOverlapItem
}

export function SyncSummariesDialog({ item }: SyncSummariesDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [sourceTemplateId, setSourceTemplateId] = useState(
    item.entries[0]?.templateId ?? ''
  )
  const [targetTemplateIds, setTargetTemplateIds] = useState<Set<string>>(
    () => {
      const ids = new Set(item.entries.map((e) => e.templateId))
      ids.delete(item.entries[0]?.templateId ?? '')
      return ids
    }
  )

  const sourceEntry = item.entries.find(
    (e) => e.templateId === sourceTemplateId
  )
  const targetEntries = item.entries.filter(
    (e) => e.templateId !== sourceTemplateId
  )

  function handleSourceChange(templateId: string) {
    setSourceTemplateId(templateId)
    // Pre-check all other templates as targets
    const ids = new Set(item.entries.map((e) => e.templateId))
    ids.delete(templateId)
    setTargetTemplateIds(ids)
  }

  function toggleTarget(templateId: string) {
    setTargetTemplateIds((prev) => {
      const next = new Set(prev)
      if (next.has(templateId)) next.delete(templateId)
      else next.add(templateId)
      return next
    })
  }

  function handleSync() {
    if (targetTemplateIds.size === 0) return

    startTransition(async () => {
      const result = await syncTemplateSummaries({
        documentId: item.documentId,
        sourceTemplateId,
        targetTemplateIds: Array.from(targetTemplateIds),
      })

      if (result.success) {
        toast.success(
          `Sammanfattningar synkade för ${result.updatedCount} mall${result.updatedCount === 1 ? '' : 'ar'}`
        )
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error ?? 'Ett oväntat fel uppstod')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Synka
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Synka sammanfattningar</DialogTitle>
          <DialogDescription>
            Kopiera sammanfattning och expertkommentar från en mall till andra
            mallar för &quot;{item.documentTitle}&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Källa</p>
            <Select value={sourceTemplateId} onValueChange={handleSourceChange}>
              <SelectTrigger>
                <SelectValue placeholder="Välj källa" />
              </SelectTrigger>
              <SelectContent>
                {item.entries.map((entry) => (
                  <SelectItem key={entry.templateId} value={entry.templateId}>
                    {entry.templateName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sourceEntry && (
              <p className="text-xs text-muted-foreground line-clamp-3">
                {sourceEntry.compliance_summary ?? 'Ingen sammanfattning'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Mål</p>
            {targetEntries.map((entry) => (
              <div key={entry.templateId} className="flex items-center gap-2">
                <Checkbox
                  id={`target-${entry.templateId}`}
                  checked={targetTemplateIds.has(entry.templateId)}
                  onCheckedChange={() => toggleTarget(entry.templateId)}
                />
                <label
                  htmlFor={`target-${entry.templateId}`}
                  className="text-sm cursor-pointer"
                >
                  {entry.templateName}
                </label>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSync}
            disabled={isPending || targetTemplateIds.size === 0}
          >
            {isPending ? 'Synkar...' : 'Synka sammanfattningar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
