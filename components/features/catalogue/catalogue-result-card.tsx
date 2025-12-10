'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { getDocumentTheme } from '@/lib/document-themes'
import { prefetchManager } from '@/lib/prefetch'
import type { BrowseResult } from '@/app/actions/browse'

interface CatalogueResultCardProps {
  document: BrowseResult
  query: string
  position: number
}

export function CatalogueResultCard({
  document,
  position,
}: CatalogueResultCardProps) {
  const router = useRouter()
  const cardRef = useRef<HTMLAnchorElement>(null)
  const theme = getDocumentTheme(document.contentType)
  const ThemeIcon = theme.icon

  const documentUrl = `${theme.href}/${document.slug}`

  // Initialize prefetch manager and trigger prefetch when card becomes visible
  useEffect(() => {
    prefetchManager.init(router)

    const card = cardRef.current
    if (!card) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            prefetchManager.add(documentUrl)
            // Unobserve after prefetch triggered - only need to prefetch once
            observer.unobserve(card)
          }
        })
      },
      {
        // Trigger when card is within 100px of viewport (prefetch slightly before visible)
        rootMargin: '100px',
        threshold: 0,
      }
    )

    observer.observe(card)

    return () => {
      observer.disconnect()
    }
  }, [router, documentUrl])

  return (
    <Link
      ref={cardRef}
      href={documentUrl}
      prefetch={true}
      className={cn(
        'group block rounded-xl border bg-card p-5',
        'transition-all duration-200',
        'hover:shadow-md hover:shadow-black/5'
      )}
      data-position={position}
    >
      {/* Title */}
      <h3 className="mb-2.5 text-base font-semibold leading-tight text-foreground group-hover:text-foreground/80">
        {document.title}
      </h3>

      {/* Meta row: Badge + Document number + Date + Status */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge className={cn('gap-1', theme.badge)}>
          <ThemeIcon className="h-3.5 w-3.5" />
          {theme.label}
        </Badge>
        <span className="text-muted-foreground">{document.documentNumber}</span>
        {document.effectiveDate && (
          <>
            <span className="text-muted-foreground/40">•</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(document.effectiveDate).toLocaleDateString('sv-SE')}
            </span>
          </>
        )}
        <Badge
          variant="outline"
          className={cn(
            'text-xs',
            document.status === 'ACTIVE' &&
              'border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400',
            document.status === 'REPEALED' &&
              'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400'
          )}
        >
          {document.status === 'ACTIVE'
            ? 'Gällande'
            : document.status === 'REPEALED'
              ? 'Upphävd'
              : document.status}
        </Badge>
      </div>

      {/* Snippet/Summary */}
      {document.snippet && (
        <p
          className="line-clamp-2 text-sm leading-relaxed text-muted-foreground [&>mark]:rounded-sm [&>mark]:bg-amber-100 [&>mark]:px-0.5 [&>mark]:font-medium [&>mark]:text-amber-800 dark:[&>mark]:bg-amber-900/50 dark:[&>mark]:text-amber-200"
          dangerouslySetInnerHTML={{ __html: document.snippet }}
        />
      )}

      {/* Category tag */}
      {document.category && (
        <div className="mt-3">
          <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {document.category}
          </span>
        </div>
      )}
    </Link>
  )
}
