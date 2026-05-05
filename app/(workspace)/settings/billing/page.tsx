/**
 * /settings/billing was the original Story 5.4 surface; it now redirects into
 * the merged "Fakturering" tab on /settings. Kept as a route so existing
 * Stripe Checkout success/cancel URLs (and any in-flight bookmarks) continue
 * to land users on the right tab without churning the API route.
 */
import { redirect } from 'next/navigation'

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function LegacyBillingRedirect({
  searchParams,
}: PageProps) {
  const params = await searchParams
  const next = new URLSearchParams({ tab: 'billing' })
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) next.set(key, value)
  }
  redirect(`/settings?${next.toString()}`)
}
