'use client'

import { usePathname } from 'next/navigation'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

const PUBLIC_ROUTE_PREFIXES = [
  '/alla-lagar',
  '/eu',
  '/foreskrifter',
  '/lagar',
  '/login',
  '/rattskallor',
  '/reset-password',
  '/signup',
  '/sok',
  '/unsubscribe',
  '/verify-email',
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
