'use client'

import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  ExternalLink,
  FileText,
  FileDown,
  Archive,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { DocumentStatusBadge } from '@/components/features/documents/document-status-badge'
import { getReviewDateStatus } from '@/lib/utils/review-date-status'
import { cn } from '@/lib/utils'

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  POLICY: 'Policy',
  RISK_ASSESSMENT: 'Riskbedömning',
  ACTION_PLAN: 'Handlingsplan',
  PROCEDURE: 'Rutin',
  INSTRUCTION: 'Instruktion',
  CHECKLIST: 'Checklista',
  REPORT: 'Rapport',
  OTHER: 'Övrigt',
}

export interface DocumentItem {
  id: string
  title: string
  document_type: string
  status: string
  document_number: string | null
  current_version_number: number
  review_date: string | null
  created_at: string
  updated_at: string
  creator: { id: string; name: string | null; email: string } | null
}

type SortField = 'title' | 'updated_at' | 'created_at' | 'review_date'

interface DocumentTableProps {
  documents: DocumentItem[]
  sortBy: SortField
  sortOrder: 'asc' | 'desc'
  onSort: (_field: SortField) => void
  onArchive: (_documentId: string) => void
}

function SortIcon({
  field,
  currentSort,
  currentOrder,
}: {
  field: SortField
  currentSort: SortField
  currentOrder: 'asc' | 'desc'
}) {
  if (field !== currentSort) {
    return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />
  }
  return currentOrder === 'asc' ? (
    <ArrowUp className="ml-1 h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 h-3 w-3" />
  )
}

function ReviewDateCell({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted-foreground">—</span>

  const status = getReviewDateStatus(date)
  const formatted = format(new Date(date), 'yyyy-MM-dd')

  return (
    <span
      className={cn(
        status === 'overdue' && 'text-red-600 font-medium',
        status === 'upcoming' && 'text-amber-600 font-medium'
      )}
    >
      {formatted}
    </span>
  )
}

export function DocumentTable({
  documents,
  sortBy,
  sortOrder,
  onSort,
  onArchive,
}: DocumentTableProps) {
  const router = useRouter()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead
            className="cursor-pointer select-none"
            onClick={() => onSort('title')}
          >
            <span className="flex items-center">
              Titel
              <SortIcon
                field="title"
                currentSort={sortBy}
                currentOrder={sortOrder}
              />
            </span>
          </TableHead>
          <TableHead>Dokumentnr</TableHead>
          <TableHead>Typ</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Författare</TableHead>
          <TableHead
            className="cursor-pointer select-none"
            onClick={() => onSort('updated_at')}
          >
            <span className="flex items-center">
              Senast uppdaterad
              <SortIcon
                field="updated_at"
                currentSort={sortBy}
                currentOrder={sortOrder}
              />
            </span>
          </TableHead>
          <TableHead
            className="cursor-pointer select-none"
            onClick={() => onSort('review_date')}
          >
            <span className="flex items-center">
              Granskningsdatum
              <SortIcon
                field="review_date"
                currentSort={sortBy}
                currentOrder={sortOrder}
              />
            </span>
          </TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <TableRow
            key={doc.id}
            className="cursor-pointer"
            onClick={() => router.push(`/workspace/documents/${doc.id}/edit`)}
          >
            <TableCell className="font-medium">{doc.title}</TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {doc.document_number ?? '—'}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type}
              </Badge>
            </TableCell>
            <TableCell>
              <DocumentStatusBadge status={doc.status} />
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              v{doc.current_version_number}
            </TableCell>
            <TableCell className="text-sm">
              {doc.creator?.name ?? doc.creator?.email ?? '—'}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {formatDistanceToNow(new Date(doc.updated_at), {
                addSuffix: true,
                locale: sv,
              })}
            </TableCell>
            <TableCell className="text-sm">
              <ReviewDateCell date={doc.review_date} />
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/workspace/documents/${doc.id}/edit`)
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Öppna
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(
                        `/api/workspace/documents/${doc.id}/export?format=docx`,
                        '_blank'
                      )
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Exportera som Word
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(
                        `/api/workspace/documents/${doc.id}/export?format=pdf`,
                        '_blank'
                      )
                    }}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    Exportera som PDF
                  </DropdownMenuItem>
                  {doc.status !== 'ARCHIVED' && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        onArchive(doc.id)
                      }}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Arkivera
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
