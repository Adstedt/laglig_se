'use client'

/**
 * Story 14.15b, Task 6: Task detail view in sidebar.
 * Shows task info with inline status selector and navigation.
 */

import { ExternalLink, User, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { TaskDetailData } from '@/lib/ai/chat-detail-context'
import type { TaskPriority } from '@prisma/client'

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Låg',
  MEDIUM: 'Medel',
  HIGH: 'Hög',
  CRITICAL: 'Kritisk',
}

const PRIORITY_VARIANT: Record<
  TaskPriority,
  'secondary' | 'default' | 'destructive' | 'outline'
> = {
  LOW: 'secondary',
  MEDIUM: 'default',
  HIGH: 'destructive',
  CRITICAL: 'destructive',
}

interface TaskDetailProps {
  data: TaskDetailData
}

export function TaskDetail({ data }: TaskDetailProps) {
  return (
    <div className="space-y-4">
      {/* Title and description */}
      <div>
        <p className="text-sm font-medium">{data.title}</p>
        {data.description && (
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
            {data.description}
          </p>
        )}
      </div>

      {/* Status and priority badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant="outline"
          style={{ borderColor: data.column.color, color: data.column.color }}
        >
          {data.column.name}
        </Badge>
        <Badge variant={PRIORITY_VARIANT[data.priority]}>
          {PRIORITY_LABELS[data.priority]}
        </Badge>
      </div>

      {/* Assignee */}
      <div>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
          Tilldelad
        </p>
        {data.assignee ? (
          <div className="flex items-center gap-2">
            {data.assignee.avatar_url ? (
              <img
                src={data.assignee.avatar_url}
                alt=""
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                <User className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
            <span className="text-sm">
              {data.assignee.name ?? data.assignee.email}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Ej tilldelad</p>
        )}
      </div>

      {/* Related documents */}
      {data.list_item_links.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            Relaterade dokument
          </p>
          <div className="space-y-1.5">
            {data.list_item_links.map((link) => (
              <div
                key={link.law_list_item.id}
                className="flex items-center gap-2 text-sm"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{link.law_list_item.document.title}</span>
                <span className="text-xs text-muted-foreground">
                  {link.law_list_item.document.document_number}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Created date */}
      <div>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Skapad
        </p>
        <p className="text-sm text-muted-foreground">
          {new Date(data.created_at).toLocaleDateString('sv-SE', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Navigation */}
      <Button variant="outline" size="sm" className="gap-1.5" asChild>
        <a href="/app/kanban">
          Visa uppgift
          <ExternalLink className="h-3 w-3" />
        </a>
      </Button>
    </div>
  )
}
