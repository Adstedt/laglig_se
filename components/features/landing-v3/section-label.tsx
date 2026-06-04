import { cn } from '@/lib/utils'

/**
 * Editorial chapter marker for the landing-v3 narrative spine:
 * amber index + hairline + sentence-case Safiro label. Replaces the generic
 * all-caps, wide-tracked eyebrow. Dark sections (the AI chapter) render their
 * own inline variant with the right light-on-dark tokens.
 */
export function SectionLabel({
  index,
  children,
  align = 'left',
  className,
}: {
  index: string
  children: React.ReactNode
  align?: 'left' | 'center'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5',
        align === 'center' && 'justify-center',
        className
      )}
    >
      <span className="font-safiro text-[15px] font-medium tabular-nums text-amber-600">
        {index}
      </span>
      <span className="h-4 w-px bg-border" />
      <span className="font-safiro text-[13px] font-medium text-muted-foreground">
        {children}
      </span>
    </div>
  )
}

/** Quiet sub-label (sentence-case Safiro) for non-chapter eyebrows. */
export function SubLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        'font-safiro text-[13px] font-medium text-muted-foreground',
        className
      )}
    >
      {children}
    </p>
  )
}
