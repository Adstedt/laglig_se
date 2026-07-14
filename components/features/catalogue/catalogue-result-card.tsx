'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { getDocumentTheme, getDocumentLabel } from '@/lib/document-themes'
import type { BrowseResult } from '@/app/actions/browse'

interface CatalogueResultCardProps {
  document: BrowseResult
  query: string
  position: number
  /** When true, links use /browse prefix to stay in workspace context */
  isWorkspace?: boolean
}

export function CatalogueResultCard({
  document,
  position,
  isWorkspace = false,
}: CatalogueResultCardProps) {
  const router = useRouter()
  const theme = getDocumentTheme(document.contentType)

  // Check if law is not yet in force (ACTIVE but future in-force date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isNotYetInForce =
    document.status === 'ACTIVE' &&
    document.inForceDate &&
    new Date(document.inForceDate) > today
  const ThemeIcon = theme.icon

  // In workspace mode, prefix URLs with /browse to stay in authenticated context
  const baseHref = isWorkspace ? `/browse${theme.href}` : theme.href
  const documentUrl = `${baseHref}/${document.slug}`

  return (
    <Link
      href={documentUrl}
      // Prefetch on intent (hover/touch) instead of viewport entry: eager
      // per-card prefetch fired ~25-50 requests per catalogue page view,
      // enough for one browsing user to exhaust their own rate limit.
      // router.prefetch dedupes repeat calls internally.
      prefetch={false}
      onMouseEnter={() => router.prefetch(documentUrl)}
      onTouchStart={() => router.prefetch(documentUrl)}
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
          {getDocumentLabel(document.contentType, document.sfsInstrument)}
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
            isNotYetInForce &&
              'border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400',
            document.status === 'ACTIVE' &&
              !isNotYetInForce &&
              'border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400',
            document.status === 'REPEALED' &&
              'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400'
          )}
        >
          {isNotYetInForce
            ? `Ikraft ${new Date(document.inForceDate!).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}`
            : document.status === 'ACTIVE'
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
