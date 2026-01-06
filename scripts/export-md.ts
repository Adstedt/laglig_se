import { config } from 'dotenv'
import { resolve } from 'path'
import { writeFileSync } from 'fs'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: {
      document_number: 'SFS 1998:1000',
      markdown_content: { not: null }
    },
    select: {
      markdown_content: true,
    }
  })
  
  if (!doc || !doc.markdown_content) {
    console.log('No document found')
    return
  }

  const outputPath = resolve(process.cwd(), 'test-results/SFS1998-1000.md')
  writeFileSync(outputPath, doc.markdown_content, 'utf-8')
  console.log('Written to:', outputPath)
  console.log('\n--- CONTENT ---\n')
  console.log(doc.markdown_content)
}

main().catch(console.error).finally(() => prisma.$disconnect())
