'use client'

/**
 * Story 6.6: Modal Footer
 * Created/updated timestamps
 */

import { format, formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Clock } from 'lucide-react'

interface ModalFooterProps {
  createdAt: Date
  updatedAt: Date
  creator: {
    id: string
    name: string | null
    email: string
  }
}

export function ModalFooter({
  createdAt,
  updatedAt,
  creator,
}: ModalFooterProps) {
  return (
    <div className="flex items-center px-6 py-3 border-t bg-muted/30">
      {/* Timestamps */}
      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>
            Skapad{' '}
            <span title={format(new Date(createdAt), 'PPpp', { locale: sv })}>
              {formatDistanceToNow(new Date(createdAt), {
                addSuffix: true,
                locale: sv,
              })}
            </span>
            {creator && <span> av {creator.name ?? creator.email}</span>}
          </span>
        </div>
        <div className="ml-4">
          Uppdaterad{' '}
          <span title={format(new Date(updatedAt), 'PPpp', { locale: sv })}>
            {formatDistanceToNow(new Date(updatedAt), {
              addSuffix: true,
              locale: sv,
            })}
          </span>
        </div>
      </div>
    </div>
  )
}
