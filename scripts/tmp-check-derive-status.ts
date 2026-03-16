import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const counts: Array<{
    content_type: string
    total: bigint
    has_json: bigint
    has_markdown: bigint
  }> = await prisma.$queryRaw`
    SELECT content_type,
           COUNT(*)::bigint as total,
           COUNT(json_content)::bigint as has_json,
           COUNT(markdown_content)::bigint as has_markdown
    FROM legal_documents
    GROUP BY content_type
    ORDER BY content_type
  `

  console.log('\nDerive Status by Content Type:')
  console.log('='.repeat(70))
  for (const row of counts) {
    const total = Number(row.total)
    const json = Number(row.has_json)
    const md = Number(row.has_markdown)
    const pct = total > 0 ? ((json / total) * 100).toFixed(1) : '0.0'
    console.log(
      `  ${String(row.content_type).padEnd(22)} total: ${String(total).padEnd(7)} json: ${String(json).padEnd(7)} md: ${String(md).padEnd(7)} (${pct}%)`
    )
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
