import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Total amendments
  const total = await prisma.legalDocument.count({
    where: { content_type: 'SFS_AMENDMENT' },
  })

  // Already have html_content
  const withHtml = await prisma.legalDocument.count({
    where: {
      content_type: 'SFS_AMENDMENT',
      html_content: { not: null },
    },
  })

  // Need processing
  const needsProcessing = total - withHtml

  console.log('=== Amendment Batch Status ===')
  console.log('Total SFS_AMENDMENT:', total.toLocaleString())
  console.log('Already have html_content:', withHtml)
  console.log('Need processing:', needsProcessing.toLocaleString())
  console.log('')
  console.log(
    'Estimated cost (~$0.02 per doc):',
    '$' + (needsProcessing * 0.02).toFixed(2)
  )
  console.log('')
  console.log('To prepare the batch, run:')
  console.log(
    '  pnpm tsx scripts/batch-process-amendments.ts prepare --limit ' +
      needsProcessing
  )

  await prisma.$disconnect()
}
main()
