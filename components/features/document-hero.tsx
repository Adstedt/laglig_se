import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { getDocumentTheme } from '@/lib/document-themes'
import type { LucideIcon } from 'lucide-react'

/**
 * Quick-info items render between the title/pill row and the action links.
 * Each item shows an icon + label pair (e.g. "Publicerad 15 januari 2026").
 */
export interface DocumentHeroInfoItem {
  icon: LucideIcon | ComponentType<{ className?: string }>
  label: ReactNode
}

/**
 * Action links render on the right side of the quick-info bar (theme-colored,
 * underline on hover). Typical uses: PDF download, Riksdagen source, EUR-Lex.
 */
export interface DocumentHeroActionLink {
  href: string
  label: string
  icon: LucideIcon | ComponentType<{ className?: string }>
  /** When true, link opens in new tab (default: true) */
  external?: boolean
  /** Show a trailing ExternalLink icon (default: true for external links) */
  showExternalIcon?: boolean
}

/**
 * Predefined status values. Rendered as rounded-full pills with a dot
 * indicator — matching the modal's COMPLIANCE_CONFIG pattern so the full-page
 * view uses the same visual grammar as the in-list modal.
 */
export type DocumentStatusKind =
  | 'active'
  | 'repealed'
  | 'draft'
  | 'archived'
  | 'not-in-force'

export interface DocumentStatusBadge {
  kind: DocumentStatusKind
  /** Required when kind === 'not-in-force' (e.g. "1 januari 2027") */
  effectiveDateLabel?: string
}

export interface DocumentHeroProps {
  title: string
  documentNumber: string
  /**
   * Document theme key from ContentType (SFS_LAW, SFS_AMENDMENT, EU_REGULATION,
   * EU_DIRECTIVE, AGENCY_REGULATION) or any string (falls back to neutral).
   */
  contentType: string
  /**
   * Overrides the theme's default label. Rarely needed unless display label
   * differs from theme (e.g. "EU-förordning" vs theme.label).
   */
  typeLabel?: string | undefined
  /** Status pill — omitted when undefined */
  status?: DocumentStatusBadge | undefined
  /**
   * Extra pills/badges appended after the status pill. Use pre-styled elements
   * (typically the `pillClass` helper) so callers control variant.
   */
  extraBadges?: ReactNode | undefined
  /** Quick-info items rendered before the action links */
  quickInfoItems?: DocumentHeroInfoItem[] | undefined
  /** Theme-colored action links on the right side of the quick-info bar */
  actionLinks?: DocumentHeroActionLink[] | undefined
  /** Primary-action controls rendered top-right of the title row */
  actions?: ReactNode | undefined
  className?: string | undefined
}

/**
 * Typographic document header. Inherits the modal's visual grammar: no card
 * chrome, rounded-full pill badges with dot indicators, thin border-b
 * separator below the quick-info bar. The page itself becomes the surface —
 * the hero is page-level chrome, not a floating surface on top of it.
 *
 * Layout:
 *  [Icon]  Title                                         (large, typographic)
 *          ● Type   SFS-number   ● Status   [extras]     (pill row)
 *  ────────────────────────────────────────────────────
 *  📅 Quick info                              ⧉ Action   (muted row)
 */
export function DocumentHero({
  title,
  documentNumber,
  contentType,
  typeLabel,
  status,
  extraBadges,
  quickInfoItems,
  actionLinks,
  actions,
  className,
}: DocumentHeroProps) {
  const theme = getDocumentTheme(contentType)
  const ThemeIcon = theme.icon
  const displayLabel = typeLabel ?? theme.label

  const hasQuickInfo =
    (quickInfoItems && quickInfoItems.length > 0) ||
    (actionLinks && actionLinks.length > 0)

  return (
    <header className={cn('pb-4', className)}>
      <div className="flex flex-wrap items-start gap-4">
        {/* Theme icon box — hidden on mobile to save space */}
        <div
          className={cn(
            'hidden h-12 w-12 shrink-0 items-center justify-center rounded-lg sm:flex',
            theme.accentLight
          )}
        >
          <ThemeIcon className={cn('h-6 w-6', theme.accent)} />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TypePill theme={theme} label={displayLabel} />
            <span className="inline-flex items-center rounded-full bg-muted/70 px-2.5 py-0.5 text-xs font-medium text-foreground/80">
              {documentNumber}
            </span>
            {status && <HeroStatusPill status={status} />}
            {extraBadges}
          </div>
        </div>

        {actions && <div className="shrink-0 self-start">{actions}</div>}
      </div>

      {hasQuickInfo && (
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-3 text-sm text-muted-foreground">
          {quickInfoItems?.map((item, idx) => {
            const Icon = item.icon
            return (
              <div key={idx} className="inline-flex items-center gap-1.5">
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </div>
            )
          })}

          {actionLinks && actionLinks.length > 0 && (
            <div className="ml-auto flex flex-wrap items-center gap-4">
              {actionLinks.map((link, idx) => {
                const Icon = link.icon
                const isExternal = link.external ?? true
                const showIcon = link.showExternalIcon ?? isExternal
                return (
                  <a
                    key={idx}
                    href={link.href}
                    {...(isExternal
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                    className={cn(
                      'inline-flex items-center gap-1.5 text-sm font-medium hover:underline',
                      theme.accent
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{link.label}</span>
                    {showIcon && <ExternalTiny />}
                  </a>
                )
              })}
            </div>
          )}
        </div>
      )}
    </header>
  )
}

/**
 * Theme-colored type pill — matches the modal's pill grammar (rounded-full,
 * icon + label, muted background) instead of the previous outlined rectangle.
 */
function TypePill({
  theme,
  label,
}: {
  theme: ReturnType<typeof getDocumentTheme>
  label: string
}) {
  const Icon = theme.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        theme.badge
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

/**
 * Rounded-full status pill with dot indicator — same visual language as the
 * modal's COMPLIANCE_CONFIG pills.
 */
function HeroStatusPill({ status }: { status: DocumentStatusBadge }) {
  const config = STATUS_PILL_CONFIG[status.kind]
  const label =
    status.kind === 'not-in-force'
      ? `Ikraft ${status.effectiveDateLabel ?? 'snart'}`
      : config.label
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
        config.strikethrough && 'line-through'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)} />
      {label}
    </span>
  )
}

const STATUS_PILL_CONFIG: Record<
  DocumentStatusKind,
  {
    label: string
    className: string
    dotColor: string
    strikethrough?: boolean
  }
> = {
  active: {
    label: 'Gällande',
    className:
      'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    dotColor: 'bg-emerald-600',
  },
  repealed: {
    label: 'Upphävd',
    className: 'bg-muted text-muted-foreground',
    dotColor: 'bg-muted-foreground/60',
    strikethrough: true,
  },
  'not-in-force': {
    label: 'Ikraft',
    className:
      'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
    dotColor: 'bg-blue-600',
  },
  draft: {
    label: 'Utkast',
    className: 'bg-slate-100 text-slate-700',
    dotColor: 'bg-slate-500',
  },
  archived: {
    label: 'Arkiverad',
    className: 'bg-muted text-muted-foreground',
    dotColor: 'bg-muted-foreground/60',
  },
}

/** Tiny external-link chevron */
function ExternalTiny() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  )
}
