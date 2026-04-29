'use client'

import * as React from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/**
 * Story 22.3 follow-up — `WorkspaceViewTabs` primitive.
 *
 * Canonical view-switcher tab strip used by every workspace tabular
 * surface (`/laglistor`, `/laglistor/kontroller/[cycleId]`, `/tasks`,
 * `/workspace/styrdokument`). Wraps shadcn `<Tabs>` with the agreed-upon
 * "loose" chrome:
 *
 *   - No enclosing muted-bg pill around the strip (each surface had a
 *     different one before consolidation: Tasks `bg-muted/50`, Laglistor
 *     bordered `bg-muted/30 p-0.5`, Styrdokument default `bg-muted`).
 *   - Active trigger renders a soft dark-fill button via shadcn's
 *     default `data-[state=active]:bg-background` token.
 *   - Inactive triggers are transparent text + optional icon.
 *
 * The thin wrappers below re-export shadcn's primitives unchanged but with
 * default class strings pre-applied. Consumers can still pass `className`
 * to override.
 */

const WorkspaceViewTabs = Tabs

const WorkspaceViewTabsList = React.forwardRef<
  React.ElementRef<typeof TabsList>,
  React.ComponentPropsWithoutRef<typeof TabsList>
>(function WorkspaceViewTabsList({ className, ...props }, ref) {
  return (
    <TabsList
      ref={ref}
      className={cn('h-auto bg-transparent p-1', className)}
      {...props}
    />
  )
})

const WorkspaceViewTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsTrigger>,
  React.ComponentPropsWithoutRef<typeof TabsTrigger>
>(function WorkspaceViewTabsTrigger({ className, ...props }, ref) {
  return (
    <TabsTrigger
      ref={ref}
      className={cn(
        'gap-2 whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm',
        className
      )}
      {...props}
    />
  )
})

export { WorkspaceViewTabs, WorkspaceViewTabsList, WorkspaceViewTabsTrigger }
export { TabsContent } from '@/components/ui/tabs'
