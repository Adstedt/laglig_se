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
/**
 * Generate a URL-safe slug from a string.
 * Strips diacritics, lowercases, replaces non-alphanumeric with hyphens.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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
