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
      html_content: { not: null }
    },
    select: {
      html_content: true,
    }
  })
  
  if (!doc || !doc.html_content) {
    console.log('No document found')
    return
  }

  const outputPath = resolve(process.cwd(), 'test-results/SFS1998-1000-raw.html')
  writeFileSync(outputPath, doc.html_content, 'utf-8')
  console.log('Written to:', outputPath)
}

main().catch(console.error).finally(() => prisma.$disconnect())
