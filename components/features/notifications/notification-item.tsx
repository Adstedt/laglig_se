'use client'

import { type ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileEdit,
  XCircle,
  Gavel,
  Clock,
  Bell,
  type LucideProps,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'

const NOTIFICATION_ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  AMENDMENT_DETECTED: FileEdit,
  LAW_REPEALED: XCircle,
  RULING_CITED: Gavel,
  AMENDMENT_REMINDER: Clock,
  TASK_ASSIGNED: Bell,
  TASK_DUE_SOON: Clock,
  TASK_OVERDUE: Clock,
  COMMENT_ADDED: Bell,
  MENTION: Bell,
  STATUS_CHANGED: Bell,
  WEEKLY_DIGEST: Bell,
}

export interface NotificationItemData {
  id: string
  type: string
  title: string
  body: string | null
  entity_type: string | null
  entity_id: string | null
  created_at: string
  link_url: string | null
}

interface NotificationItemProps {
  notification: NotificationItemData
  onMarkRead: (_id: string) => Promise<void>
  onClose: () => void
}

export function NotificationItem({
  notification,
  onMarkRead,
  onClose,
}: NotificationItemProps) {
  const router = useRouter()
  const Icon = NOTIFICATION_ICON_MAP[notification.type] || Bell

  const truncatedTitle =
    notification.title.length > 50
      ? notification.title.slice(0, 50) + '…'
      : notification.title

  const relativeTime = formatDistanceToNow(new Date(notification.created_at), {
    locale: sv,
    addSuffix: true,
  })

  const handleClick = async () => {
    await onMarkRead(notification.id)
    onClose()
    if (notification.link_url) {
      router.push(notification.link_url)
    }
  }

  return (
    <button
      onClick={handleClick}
      className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-medium leading-tight"
          title={notification.title}
        >
          {truncatedTitle}
        </p>
        {notification.body && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
            {notification.body}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground/70">{relativeTime}</p>
      </div>
    </button>
  )
}
