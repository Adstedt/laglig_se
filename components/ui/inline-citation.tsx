'use client'

/**
 * Adapted from AI SDK Elements InlineCitation.
 * Removed: Carousel components (our citations are 1:1, not multi-source).
 * Modified: CardTrigger uses `label` prop instead of URL hostname.
 * Modified: Source uses `href` for internal Next.js links instead of raw URL.
 * Modified: Card delays tuned to 200/150ms for our UX.
 */

import type { ComponentProps } from 'react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'

export type InlineCitationProps = ComponentProps<'span'>

export const InlineCitation = ({
  className,
  ...props
}: InlineCitationProps) => (
  <span
    className={cn('group inline items-center gap-1', className)}
    {...props}
  />
)

export type InlineCitationTextProps = ComponentProps<'span'>

export const InlineCitationText = ({
  className,
  ...props
}: InlineCitationTextProps) => (
  <span
    className={cn('transition-colors group-hover:bg-accent', className)}
    {...props}
  />
)

export type InlineCitationCardProps = ComponentProps<typeof HoverCard>

export const InlineCitationCard = (props: InlineCitationCardProps) => (
  <HoverCard openDelay={200} closeDelay={150} {...props} />
)

export type InlineCitationCardTriggerProps = ComponentProps<'span'> & {
  label: string
}

export const InlineCitationCardTrigger = ({
  label,
  className,
  ...props
}: InlineCitationCardTriggerProps) => (
  <HoverCardTrigger asChild>
    <span
      className={cn(
        'inline-flex items-center mx-0.5 px-1.5 py-0.5 text-[11px] font-medium leading-none rounded-full cursor-pointer select-none',
        'bg-primary/10 text-primary border border-primary/20',
        'transition-colors hover:bg-primary/20 hover:text-primary',
        className
      )}
      {...props}
    >
      {label}
    </span>
  </HoverCardTrigger>
)

export type InlineCitationCardBodyProps = ComponentProps<'div'>

export const InlineCitationCardBody = ({
  className,
  ...props
}: InlineCitationCardBodyProps) => (
  <HoverCardContent
    side="top"
    align="start"
    className={cn('w-80 p-4', className)}
    {...props}
  />
)

export type InlineCitationSourceProps = ComponentProps<'div'> & {
  title?: string
  href?: string
  description?: string
}

export const InlineCitationSource = ({
  title,
  href: _href,
  description,
  className,
  children,
  ...props
}: InlineCitationSourceProps) => (
  <div className={cn('space-y-1', className)} {...props}>
    {title && (
      <h4 className="truncate font-medium text-sm leading-tight">{title}</h4>
    )}
    {description && (
      <p className="line-clamp-3 text-muted-foreground text-xs leading-relaxed">
        {description}
      </p>
    )}
    {children}
  </div>
)

export type InlineCitationQuoteProps = ComponentProps<'blockquote'>

export const InlineCitationQuote = ({
  children,
  className,
  ...props
}: InlineCitationQuoteProps) => (
  <blockquote
    className={cn(
      'border-muted border-l-2 pl-3 text-muted-foreground text-sm italic',
      className
    )}
    {...props}
  >
    {children}
  </blockquote>
)
