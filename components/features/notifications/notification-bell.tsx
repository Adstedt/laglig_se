'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import {
  NotificationItem,
  type NotificationItemData,
} from './notification-item'

const POLL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

interface NotificationBellProps {
  userId?: string | undefined
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const { workspaceId, isLoading: workspaceLoading } = useWorkspace()

  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationItemData[]>([])
  const [isLoadingList, setIsLoadingList] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const canFetch = !!userId && !!workspaceId && !workspaceLoading

  const fetchUnreadCount = useCallback(async () => {
    if (!canFetch) return
    try {
      const res = await fetch('/api/notifications/unread-count')
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.count)
      }
    } catch {
      // Silently fail — bell shows without badge
    }
  }, [canFetch])

  const fetchNotifications = useCallback(async () => {
    if (!canFetch) return
    setIsLoadingList(true)
    try {
      const res = await fetch('/api/notifications?limit=5')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data)
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoadingList(false)
    }
  }, [canFetch])

  // Initial fetch + polling for unread count
  useEffect(() => {
    if (!canFetch) return

    fetchUnreadCount()

    intervalRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [canFetch, fetchUnreadCount])

  // Fetch notification list when popover opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      fetchNotifications()
    }
  }

  const handleMarkRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // Silently fail
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', { method: 'PATCH' })
      setNotifications([])
      setUnreadCount(0)
    } catch {
      // Silently fail
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 ml-2"
          aria-label={
            unreadCount > 0
              ? `${unreadCount} olästa notifieringar`
              : 'Notifieringar'
          }
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifieringar</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-muted-foreground"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Markera alla som lästa
            </Button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto">
          {isLoadingList ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-4 w-4 shrink-0 rounded" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-2.5 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Inga nya notifieringar
            </p>
          ) : (
            <div className="py-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                  onClose={() => setIsOpen(false)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-auto w-full px-2 py-1.5 text-xs text-muted-foreground"
            disabled
          >
            Visa alla
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
