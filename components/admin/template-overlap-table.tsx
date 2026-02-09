'use client'

import { AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { ContentStatusBadge } from '@/components/admin/content-status-badge'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { TemplateOverlapItem } from '@/lib/admin/template-queries'

import { SyncSummariesDialog } from './sync-summaries-dialog'

interface TemplateOverlapTableProps {
  data: TemplateOverlapItem[]
}

export function TemplateOverlapTable({ data }: TemplateOverlapTableProps) {
  const [expandedDocIds, setExpandedDocIds] = useState<Set<string>>(new Set())
  const [showOnlyInconsistent, setShowOnlyInconsistent] = useState(false)

  const filteredData = showOnlyInconsistent
    ? data.filter((d) => d.isInconsistent)
    : data

  function toggleExpand(docId: string) {
    setExpandedDocIds((prev) => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId)
      else next.add(docId)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="filter-inconsistent"
          checked={showOnlyInconsistent}
          onCheckedChange={(checked) =>
            setShowOnlyInconsistent(checked === true)
          }
        />
        <label
          htmlFor="filter-inconsistent"
          className="text-sm cursor-pointer select-none"
        >
          Visa bara inkonsekvenser
        </label>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Dokument</TableHead>
              <TableHead>SFS/AFS</TableHead>
              <TableHead>Mallar</TableHead>
              <TableHead className="text-right">Antal mallar</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length > 0 ? (
              filteredData.map((item) => (
                <OverlapRow
                  key={item.documentId}
                  item={item}
                  isExpanded={expandedDocIds.has(item.documentId)}
                  onToggle={() => toggleExpand(item.documentId)}
                />
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  {showOnlyInconsistent
                    ? 'Inga inkonsekvenser hittades'
                    : 'Inga överlappande dokument'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function OverlapRow({
  item,
  isExpanded,
  onToggle,
}: {
  item: TemplateOverlapItem
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
          />
        </TableCell>
        <TableCell className="font-medium">{item.documentTitle}</TableCell>
        <TableCell className="text-muted-foreground">
          {item.documentNumber ?? '—'}
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {item.entries.map((entry) => (
              <Badge key={entry.templateId} variant="outline">
                {entry.templateName}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell className="text-right">{item.templateCount}</TableCell>
        <TableCell>
          {item.isInconsistent ? (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Inkonsekvent</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">Konsekvent</span>
            </span>
          )}
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-4">
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${item.entries.length}, minmax(0, 1fr))`,
              }}
            >
              {item.entries.map((entry) => (
                <div key={entry.templateId} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">
                      {entry.templateName}
                    </h4>
                    <ContentStatusBadge status={entry.content_status} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Sammanfattning
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {entry.compliance_summary ?? (
                        <span className="italic text-muted-foreground">
                          Ingen sammanfattning
                        </span>
                      )}
                    </p>
                  </div>
                  {entry.expert_commentary && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Expertkommentar
                      </p>
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                        {entry.expert_commentary}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4">
              <SyncSummariesDialog item={item} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
