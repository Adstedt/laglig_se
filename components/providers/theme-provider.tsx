'use client'

import { usePathname } from 'next/navigation'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

// Routes that force light theme regardless of user's system/OS preference.
// All pre-login + onboarding surfaces — users haven't reached the workspace
// shell yet, so the dashboard's dark-mode toggle doesn't apply. Marketing
// surfaces in particular need a consistent light look.
const PUBLIC_ROUTE_PREFIXES = [
  '/alla-lagar',
  '/cookiepolicy',
  '/eu',
  '/foreskrifter',
  '/integritetspolicy',
  '/lagar',
  '/login',
  '/onboarding',
  '/personuppgiftsbitradesavtal',
  '/rattskallor',
  '/reset-password',
  '/select-workspace',
  '/signup',
  '/sok',
  '/underbitraden',
  '/unsubscribe',
  '/verify-email',
  '/villkor',
]

function isPublicRoute(pathname: string | null): boolean {
  if (!pathname) return false
  if (pathname === '/') return true
  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const pathname = usePathname()
  const forcedTheme = isPublicRoute(pathname) ? 'light' : props.forcedTheme

  return (
    <NextThemesProvider {...props} forcedTheme={forcedTheme}>
      {children}
    </NextThemesProvider>
  )
}
