import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const docs = await p.legalDocument.findMany({
    where: {
      document_number: {
        in: [
          'AFS 2023:1',
          'SFS SFS:2025-18',
          '32016R0679',
          'MSBFS 2009:1',
          'SFS 1977:1160',
        ],
      },
    },
    select: { slug: true, document_number: true, title: true },
  })
  for (const d of docs)
    console.log(`${d.document_number} → /${d.slug} — ${d.title}`)
}
main().finally(() => p.$disconnect())
