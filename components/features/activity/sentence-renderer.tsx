'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { SentencePart } from '@/lib/activity/types'

interface SentenceRendererProps {
  parts: SentencePart[]
  className?: string
}

/**
 * Renders a SentencePart[] inline. Users are rendered in strong, links are
 * Next.js Link components (or plain span when the entity has been deleted or
 * has no detail page), emphasis in semibold. Empty parts degrade gracefully.
 */
export function SentenceRenderer({ parts, className }: SentenceRendererProps) {
  return (
    <span className={cn('text-sm leading-relaxed', className)}>
      {parts.map((part, index) => {
        const key = `${index}-${part.kind}`
        switch (part.kind) {
          case 'user':
            return (
              <strong key={key} className="font-semibold text-foreground">
                {part.name}
              </strong>
            )
          case 'text':
            return (
              <span key={key} className="text-muted-foreground">
                {part.value}
              </span>
            )
          case 'emphasis':
            return (
              <em key={key} className="not-italic font-medium text-foreground">
                {part.value}
              </em>
            )
          case 'link': {
            if (part.deleted || part.href === '#') {
              return (
                <span
                  key={key}
                  className="font-medium text-muted-foreground line-through decoration-muted-foreground/40"
                  title="Borttagen"
                >
                  {part.label}
                </span>
              )
            }
            return (
              <Link
                key={key}
                href={part.href}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {part.label}
              </Link>
            )
          }
          default:
            return null
        }
      })}
    </span>
  )
}
