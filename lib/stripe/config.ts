/**
 * Story 5.4: Stripe SDK client + price-ID map.
 *
 * Omit explicit apiVersion to use the SDK's pinned default — keeps SDK types
 * aligned with the runtime payload, avoids drift between stripe@14 minor
 * releases (per Dev Notes "Stripe SDK / API version notes").
 */
import Stripe from 'stripe'
import { env } from '@/lib/env'

export const stripe = new Stripe(env.STRIPE_SECRET_KEY)

export const STRIPE_PRICE_IDS = {
  SOLO: env.STRIPE_SOLO_PRICE_ID,
  TEAM: env.STRIPE_TEAM_PRICE_ID,
  ENTERPRISE: env.STRIPE_ENTERPRISE_PRICE_ID,
} as const

export type StripePaidTier = keyof typeof STRIPE_PRICE_IDS

/**
 * Resolve a Stripe price ID back to its SubscriptionTier enum value.
 * Used by the customer.subscription.updated webhook to translate
 * upgrade/downgrade events into a Workspace.subscription_tier write.
 */
export function tierForPriceId(priceId: string): StripePaidTier | undefined {
  return (Object.entries(STRIPE_PRICE_IDS) as [StripePaidTier, string][]).find(
    ([, id]) => id === priceId
  )?.[0]
}
