'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { moveTemplateItem } from '@/app/actions/admin-templates'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_VARIANT,
} from '@/lib/admin/constants'
import type { TemplateSectionItem } from '@/lib/admin/template-queries'
import type { TemplateItemContentStatus } from '@prisma/client'

export interface SectionOption {
  id: string
  name: string
}

interface TemplateSectionItemsProps {
  sectionId: string
  templateId: string
  availableSections?: SectionOption[]
}

export function TemplateSectionItems({
  sectionId,
  availableSections = [],
}: TemplateSectionItemsProps) {
  const [items, setItems] = useState<TemplateSectionItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/admin/template-section-items?sectionId=${sectionId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Kunde inte hämta objekt')
        return res.json()
      })
      .then((data: { items: TemplateSectionItem[] }) => {
        if (!cancelled) {
          setItems(data.items)
          setLoading(false)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [sectionId])

  const handleMoveItem = (itemId: string, newSectionId: string) => {
    startTransition(async () => {
      const result = await moveTemplateItem(itemId, newSectionId)
      if (result.success) {
        toast.success('Objekt flyttat')
        setItems((prev) =>
          prev ? prev.filter((item) => item.id !== itemId) : prev
        )
      } else {
        toast.error(result.error ?? 'Kunde inte flytta objekt')
      }
    })
  }

  const otherSections = availableSections.filter((s) => s.id !== sectionId)

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground py-2">Laddar objekt...</p>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive py-2">{error}</p>
  }

  if (!items || items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Inga objekt i denna sektion
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Dokument</TableHead>
          <TableHead>SFS/AFS</TableHead>
          <TableHead>Källa</TableHead>
          <TableHead>Sammanfattning</TableHead>
          <TableHead>Innehållsstatus</TableHead>
          {otherSections.length > 0 && <TableHead>Flytta till</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium max-w-[200px] truncate">
              {item.document.title}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {item.document.document_number ?? '—'}
            </TableCell>
            <TableCell>
              {item.source_type ? (
                <Badge variant="outline" className="text-xs">
                  {item.source_type}
                </Badge>
              ) : (
                '—'
              )}
            </TableCell>
            <TableCell className="max-w-[200px]">
              <span className="text-sm text-muted-foreground truncate block">
                {item.compliance_summary
                  ? item.compliance_summary.length > 100
                    ? `${item.compliance_summary.slice(0, 100)}...`
                    : item.compliance_summary
                  : '—'}
              </span>
            </TableCell>
            <TableCell>
              <ContentStatusBadge status={item.content_status} />
            </TableCell>
            {otherSections.length > 0 && (
              <TableCell>
                <Select
                  disabled={isPending}
                  onValueChange={(value) => handleMoveItem(item.id, value)}
                >
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder="Flytta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {otherSections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ContentStatusBadge({ status }: { status: TemplateItemContentStatus }) {
  const variant = CONTENT_STATUS_VARIANT[status]
  const label = CONTENT_STATUS_LABELS[status]

  return (
    <Badge
      variant={variant}
      className={
        status === 'APPROVED' ? 'bg-green-100 text-green-800' : undefined
      }
    >
      {label}
    </Badge>
  )
}
