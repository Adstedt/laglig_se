import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const stats = await prisma.$queryRawUnsafe<any[]>(
    `SELECT
       content_type,
       COUNT(*) as doc_count,
       SUM(LENGTH(html_content)) as total_bytes,
       AVG(LENGTH(html_content)) as avg_bytes,
       MAX(LENGTH(html_content)) as max_bytes
     FROM legal_documents
     WHERE html_content IS NOT NULL
     GROUP BY content_type
     ORDER BY total_bytes DESC`
  )

  let grandTotalBytes = 0
  let grandTotalDocs = 0

  console.log(
    'Content Type'.padEnd(30),
    'Docs'.padStart(7),
    'Total MB'.padStart(10),
    'Avg KB'.padStart(10),
    'Max KB'.padStart(10)
  )
  console.log('-'.repeat(70))

  for (const s of stats) {
    const totalMB = (Number(s.total_bytes) / 1024 / 1024).toFixed(1)
    const avgKB = (Number(s.avg_bytes) / 1024).toFixed(1)
    const maxKB = (Number(s.max_bytes) / 1024).toFixed(1)
    grandTotalBytes += Number(s.total_bytes)
    grandTotalDocs += Number(s.doc_count)
    console.log(
      s.content_type.padEnd(30),
      String(Number(s.doc_count)).padStart(7),
      totalMB.padStart(10),
      avgKB.padStart(10),
      maxKB.padStart(10)
    )
  }

  console.log('-'.repeat(70))
  console.log(
    'TOTAL'.padEnd(30),
    String(grandTotalDocs).padStart(7),
    (grandTotalBytes / 1024 / 1024).toFixed(1).padStart(10)
  )

  // Cost estimate
  const totalTokens = grandTotalBytes / 3 // ~3 chars per token for HTML
  const inputCost = (totalTokens / 1_000_000) * 0.8
  const outputCost = (totalTokens / 1_000_000) * 4.0
  const totalCost = inputCost + outputCost

  console.log(`\n=== COST ESTIMATE (Haiku) ===`)
  console.log(`Total chars: ${(grandTotalBytes / 1_000_000).toFixed(1)}M`)
  console.log(
    `Est. tokens (in+out): ${(totalTokens / 1_000_000).toFixed(1)}M each`
  )
  console.log(`Input:  $${inputCost.toFixed(0)}`)
  console.log(`Output: $${outputCost.toFixed(0)}`)
  console.log(`Total:  $${totalCost.toFixed(0)}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
