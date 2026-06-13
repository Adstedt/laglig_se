/* eslint-disable no-console */
/**
 * Story 26.6 — removes the ONE synthetic ChangeEvent created by
 * scripts/seed-26-6-feature-staging.ts (REPEAL of SFS 2018:1174 by
 * SFS 2025:1506). The event is factually true, but it was hand-seeded rather
 * than pipeline-detected; run this after the screenshot session if you want
 * the catalog to carry only pipeline-detected events. Cascades to the
 * Tärnudden assessment on it.
 *
 * Run: pnpm tsx scripts/cleanup-26-6-synthetic-events.ts
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })
// eslint-disable-next-line import/first
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const deleted = await prisma.changeEvent.deleteMany({
    where: {
      change_type: 'REPEAL',
      amendment_sfs: 'SFS 2025:1506',
      document: { document_number: 'SFS 2018:1174' },
    },
  })
  console.log(`deleted ${deleted.count} synthetic REPEAL event(s)`)
}
main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
