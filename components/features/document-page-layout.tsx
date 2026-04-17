import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DocumentPageLayoutProps {
  /** When true, use workspace shell (no gradient, no breadcrumbs wrapper) */
  isWorkspace?: boolean
  /** Breadcrumb nav rendered above the hero (public pages) */
  breadcrumbs?: ReactNode
  /** Footer rendered below the content */
  footer?: ReactNode
  /** Optional className applied to the inner max-w-4xl container */
  className?: string
  children: ReactNode
}

/**
 * Consistent wrapper for all legal document pages.
 *
 * - Public: gradient `<main>` with container + breadcrumbs slot.
 * - Workspace: bare `<div>` (workspace shell already provides surface/padding).
 *
 * Both variants set `has-hero-header` so the `.legal-document .lovhead`
 * rule in globals.css hides the redundant Riksdagen metadata block (which
 * duplicates info already shown in the hero card).
 */
export function DocumentPageLayout({
  isWorkspace = false,
  breadcrumbs,
  footer,
  className,
  children,
}: DocumentPageLayoutProps) {
  if (isWorkspace) {
    return (
      <div
        className={cn('has-hero-header mx-auto max-w-4xl space-y-6', className)}
      >
        {children}
        {footer}
      </div>
    )
  }

  return (
    <main className="has-hero-header min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div
        className={cn(
          'container mx-auto max-w-4xl space-y-6 px-4 py-6',
          className
        )}
      >
        {breadcrumbs}
        {children}
        {footer}
      </div>
    </main>
  )
}
