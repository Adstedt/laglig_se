import * as React from 'react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

/**
 * Story 22.3 — `PageHeader` + `PageHeader.Meta` primitives.
 *
 * Workspace page header with named slots. Slot order is enforced by the
 * primitive (devs cannot accidentally reorder by re-arranging props):
 *
 *   breadcrumbs
 *   ──────────────────────────────────────────────────────────────
 *   title (+ inline badge)            stats │ secondaryActions │ primaryAction
 *   subtitle / meta
 *   ──────────────────────────────────────────────────────────────
 *
 * Action-verb convention enforced across migrated surfaces:
 *   - `Ny X` / `Nytt X` — top-level primary creates (e.g. `Ny uppgift`,
 *     `Nytt dokument`). Established `Skapa kontroll` retained for back-
 *     compat (not changing for this story).
 *   - `Lägg till X` — additive actions inside an existing context
 *     (e.g. `Lägg till dokument` inside a laglista, `Lägg till
 *     anmärkning` inside a cycle).
 */

export interface PageHeaderStatProps {
  label: string
  value: string | React.ReactNode
}

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  breadcrumbs?: React.ReactNode
  title: string
  badge?: React.ReactNode
  subtitle?: string
  meta?: React.ReactNode
  stats?: PageHeaderStatProps[]
  primaryAction?: React.ReactNode
  secondaryActions?: React.ReactNode
}

interface PageHeaderComponent extends React.ForwardRefExoticComponent<
  PageHeaderProps & React.RefAttributes<HTMLDivElement>
> {
  Meta: typeof PageHeaderMeta
}

const PageHeaderImpl = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  function PageHeader(
    {
      breadcrumbs,
      title,
      badge,
      subtitle,
      meta,
      stats,
      primaryAction,
      secondaryActions,
      className,
      ...rest
    },
    ref
  ) {
    return (
      <div ref={ref} className={cn('space-y-4', className)} {...rest}>
        {breadcrumbs ? <div className="text-xs">{breadcrumbs}</div> : null}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {badge ? <span className="shrink-0">{badge}</span> : null}
            </div>

            {subtitle ? (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}

            {meta ? <div className="mt-1.5">{meta}</div> : null}
          </div>

          {(stats?.length || secondaryActions || primaryAction) && (
            <div className="flex flex-wrap items-center gap-3">
              {stats?.length ? (
                <>
                  <div className="flex items-center gap-4">
                    {stats.map((stat) => (
                      <div key={stat.label} className="text-right">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">
                          {stat.label}
                        </div>
                        <div className="text-sm font-semibold">
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>
                  {(secondaryActions || primaryAction) && (
                    <div className="h-8 w-px bg-border" aria-hidden="true" />
                  )}
                </>
              ) : null}
              {secondaryActions ? <div>{secondaryActions}</div> : null}
              {primaryAction ? <div>{primaryAction}</div> : null}
            </div>
          )}
        </div>

        <Separator />
      </div>
    )
  }
)

export interface PageHeaderMetaItem {
  icon?: React.ReactNode
  label: string
}

export interface PageHeaderMetaProps extends React.HTMLAttributes<HTMLDivElement> {
  items: Array<string | PageHeaderMetaItem>
}

function PageHeaderMeta({ items, className, ...rest }: PageHeaderMetaProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
        className
      )}
      {...rest}
    >
      {items.map((raw, idx) => {
        const item: PageHeaderMetaItem =
          typeof raw === 'string' ? { label: raw } : raw
        return (
          <React.Fragment key={`${item.label}-${idx}`}>
            {idx > 0 ? (
              <span className="text-border" aria-hidden="true">
                ·
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              {item.icon}
              <span>{item.label}</span>
            </span>
          </React.Fragment>
        )
      })}
    </div>
  )
}

const PageHeader = PageHeaderImpl as PageHeaderComponent
PageHeader.Meta = PageHeaderMeta

export { PageHeader }
