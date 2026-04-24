'use client'

import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  // Wire Sonner's internal theme to next-themes so its CSS variables match
  // the active app theme. Previously hardcoded to "light" — caused dark-mode
  // toasts to render with light-theme internals, producing low-contrast
  // (often unreadable) description text against the dark surface.
  const { resolvedTheme } = useTheme()
  const theme = (resolvedTheme as ToasterProps['theme']) ?? 'system'

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          // Description: in dark mode `text-muted-foreground` is too faint
          // against `bg-background`. Lift the contrast with an opacity-based
          // foreground token so it stays readable in both themes without
          // losing the secondary visual weight.
          description:
            'group-[.toast]:text-foreground/80 dark:group-[.toast]:text-foreground/85',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
