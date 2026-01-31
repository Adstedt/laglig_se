import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validate a redirect URL to prevent open redirects.
 * Only allows relative paths starting with `/`.
 * Returns `/dashboard` for any invalid or external URL.
 */
export function getSafeRedirectUrl(url: string | null | undefined): string {
  if (
    !url ||
    !url.startsWith('/') ||
    url.startsWith('//') ||
    url.includes('://')
  ) {
    return '/dashboard'
  }
  return url
}
