import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'
const prisma = new PrismaClient()
async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2025:99' },
    select: { html_content: true },
  })
  if (doc?.html_content) {
    writeFileSync(
      'data/amendment-normalizer-test/SFS-2025-99-db.html',
      doc.html_content
    )
    console.log(`Saved: ${doc.html_content.length} chars`)
  }
}
main().finally(() => prisma.$disconnect())
