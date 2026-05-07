/**
 * One-time fix: TreDoffice AB has test-mode Stripe IDs stored on a prod
 * workspace. Live key can't retrieve them → chat 500s on every turn.
 *
 * The code fix in lib/usage/seat-cache.ts now makes chat fail-open on
 * Stripe errors, so this is no longer urgent. But the IDs are still
 * wrong on the data layer and should be cleared so the billing portal
 * (/api/billing/portal) and the seat-enforcement path also recover.
 *
 * Sets: stripe_subscription_id = NULL, stripe_customer_id = NULL,
 *       trial_picked_tier = NULL (so effective tier falls to subscription_tier=SOLO)
 *
 * If TreDoffice eventually re-subscribes via live Stripe, the webhook
 * will populate fresh live-mode IDs.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TREDOFFICE_ID = 'a7acf350-091b-42fd-9006-0cefa33cc22d'

async function main() {
  const before = await prisma.workspace.findUnique({
    where: { id: TREDOFFICE_ID },
    select: {
      name: true,
      subscription_tier: true,
      trial_picked_tier: true,
      stripe_subscription_id: true,
      stripe_customer_id: true,
    },
  })
  console.log('BEFORE:', JSON.stringify(before, null, 2))

  if (!before) {
    console.error('TreDoffice workspace not found — bailing out')
    process.exit(1)
  }

  const updated = await prisma.workspace.update({
    where: { id: TREDOFFICE_ID },
    data: {
      stripe_subscription_id: null,
      stripe_customer_id: null,
      trial_picked_tier: null,
    },
    select: {
      name: true,
      subscription_tier: true,
      trial_picked_tier: true,
      stripe_subscription_id: true,
      stripe_customer_id: true,
    },
  })
  console.log('AFTER:', JSON.stringify(updated, null, 2))
}

main()
  .catch((err) => {
    console.error('FATAL:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
